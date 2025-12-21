import { kv } from "@vercel/kv";
import { getSessionFromRequest, SESSION_TTL_SECONDS, refreshToken } from "./session.js";

export async function rateLimit(req, res) {
  const state = getSessionFromRequest(req);
  const key = `rate-limit:${state}`;

  const limit = 100; // Max requests
  const windowSeconds = 15 * 60; // 15 minutes

  const requests = await kv.incr(key);

  if (requests === 1) {
    await kv.expire(key, windowSeconds);
  }

  if (requests > limit) {
    res.status(429).json({ message: "Too many requests, try again later." });
    return false;
  }

  return true;
}

export async function getStravaContext(req, res) {
  const allowed = await rateLimit(req, res);
  if (!allowed) return null;

  const missing = [
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ].filter((k) => !process.env[k]);

  if (missing.length) {
    res.status(500).send(`Missing env vars: ${missing.join(", ")}`);
    return null;
  }

  const state = getSessionFromRequest(req);
  if (!state) {
    res.status(401).send("Missing session state.");
    return null;
  }

  const sessionKey = `atlo:session:${state}`;
  const session = await kv.get(sessionKey);
  if (!session) {
    res.status(401).send("Session expired; please authenticate.");
    return null;
  }

  await kv.expire(sessionKey, SESSION_TTL_SECONDS);

  let token = await kv.get(`strava:token:${state}`);
  if (!token) {
    res.status(404).send("No token; please authenticate first.");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    token.expires_at &&
    token.expires_at <= now + 60 &&
    token.refresh_token
  ) {
    const refreshed = await refreshToken(state, token);
    if (refreshed) token = refreshed;
  }

  return { state, session, token };
}
