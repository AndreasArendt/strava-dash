import { kv } from "@vercel/kv";

export const config = { runtime: "nodejs" };

function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies[name];
}

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

    const state = getCookie(req, "strava_state");
    if (!state) return res.status(401).send("Missing session state.");

    let token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("No token; please authenticate first.");

    const now = Math.floor(Date.now() / 1000);
    if (token.expires_at && token.expires_at <= now + 60 && token.refresh_token) {
      const refreshed = await refreshToken(state, token);
      if (refreshed) token = refreshed;
    }

    const after = req.query.after || "2023-01-01";
    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(new Date(after).getTime() / 1000)}`,
      {
        headers: { Authorization: `Bearer ${token.access_token}` }
      }
    );

    if (!resp.ok) {
      const msg = await resp.text();
      return res.status(502).send(`Activities fetch failed: ${msg}`);
    }

    const data = await resp.json();
    const simplified = data
      .filter((a) => a.map && a.map.summary_polyline)
      .map((a) => ({
        polyline: a.map.summary_polyline,
        type: a.type,
        name: a.name,
        id: a.id,
        date: a.start_date
      }));

    return res.status(200).json(simplified);
  } catch (err) {
    console.log("Error in /api/activities:", err.message);
    return res.status(500).send("Internal error");
  }
}
