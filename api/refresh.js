import { kv } from "@vercel/kv";
import { getStateFromRequest, STATE_TTL_SECONDS } from "../lib/state.js";

export const config = { runtime: "nodejs" };

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

    const current = await kv.get(`strava:token:${state}`);
    if (!current || !current.refresh_token) {
      return res.status(404).send("No refresh token; please re-authenticate.");
    }

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

    if (!resp.ok) {
      const msg = await resp.text();
      return res.status(502).send(`Refresh failed: ${msg}`);
    }

    const token = await resp.json();
    const ttlSeconds = 60 * 60 * 24 * 30;
    await kv.set(`strava:token:${state}`, token, { ex: ttlSeconds });
    await kv.expire(sessionKey, STATE_TTL_SECONDS);

    return res.status(200).json(token);
  } catch (err) {
    console.log("Error in /api/refresh:", err.message);
    return res.status(500).send("Internal error");
  }
}
