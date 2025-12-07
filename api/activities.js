import { kv } from "@vercel/kv";
import { getStateFromRequest, STATE_TTL_SECONDS } from "../lib/state.js";

export const config = { runtime: "nodejs" };

async function refreshToken(state, current) {
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: current.refresh_token
    })
  });

  if (!resp.ok) return null;
  const token = await resp.json();
  const ttlSeconds = 60 * 60 * 24 * 30;
  await kv.set(`strava:token:${state}`, token, { ex: ttlSeconds });
  return token;
}

export default async function handler(req, res) {
  try {
    const missing = [
      "STRAVA_CLIENT_ID",
      "STRAVA_CLIENT_SECRET",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN"
    ].filter((k) => !process.env[k]);
    if (missing.length) {
      return res.status(500).send(`Missing env vars: ${missing.join(", ")}`);
    }

    const state = getStateFromRequest(req);
    if (!state) return res.status(401).send("Missing session state.");

    const sessionKey = `atlo:session:${state}`;
    const session = await kv.get(sessionKey);
    if (!session) return res.status(401).send("Session expired; please authenticate.");
    await kv.expire(sessionKey, STATE_TTL_SECONDS);

    let token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("No token; please authenticate first.");

    const now = Math.floor(Date.now() / 1000);
    if (token.expires_at && token.expires_at <= now + 60 && token.refresh_token) {
      const refreshed = await refreshToken(state, token);
      if (refreshed) token = refreshed;
    }

    const nowDate = new Date();
    const defaultAfter = new Date(nowDate);
    defaultAfter.setFullYear(defaultAfter.getFullYear() - 1);

    const toUnix = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : Math.floor(parsed.getTime() / 1000);
    };

    const afterSeconds = toUnix(req.query.after, Math.floor(defaultAfter.getTime() / 1000));
    const beforeSeconds = toUnix(req.query.before, Math.floor(nowDate.getTime() / 1000));

    const baseParams = new URLSearchParams();
    if (afterSeconds) baseParams.set("after", afterSeconds.toString());
    if (beforeSeconds && beforeSeconds > afterSeconds) {
      baseParams.set("before", beforeSeconds.toString());
    }

    const perPage = 200;
    let page = 1;
    const simplified = [];

    while (true) {
      const params = new URLSearchParams(baseParams);
      params.set("page", page.toString());
      params.set("per_page", perPage.toString());

      const resp = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token.access_token}` }
        }
      );

      if (!resp.ok) {
        const msg = await resp.text();
        return res.status(502).send(`Activities fetch failed: ${msg}`);
      }

      const data = await resp.json();
      simplified.push(
        ...data
          .filter((a) => a.map && a.map.summary_polyline)
          .map((a) => ({
            polyline: a.map.summary_polyline,
            type: a.type,
            name: a.name,
            id: a.id,
            date: a.start_date
          }))
      );

      if (data.length < perPage) break;
      page += 1;
    }

    return res.status(200).json(simplified);
  } catch (err) {
    console.log("Error in /api/activities:", err.message);
    return res.status(500).send("Internal error");
  }
}
