import { createCookie } from "../lib/cookie.js";
import { getKvClient } from "../lib/database.js";
import {
  buildSessionCookieValue,
  createSession,
  getSessionFromRequest,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS
} from "../lib/session.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res
      .status(500)
      .send(
        "Missing STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET environment variables."
      );
  }

  const kv = getKvClient();
  let state = getSessionFromRequest(req);

  if (state) {
    const sessionKey = `atlo:session:${state}`;
    const existing = await kv.get(sessionKey);
    if (!existing) {
      const session = await createSession(SESSION_TTL_SECONDS);
      state = session.state;
    } else {
      await kv.expire(sessionKey, SESSION_TTL_SECONDS);
    }
  } else {
    const session = await createSession(SESSION_TTL_SECONDS);
    state = session.state;
  }

  const cookieValue = buildSessionCookieValue(state);

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.BASE_URL}/api/strava`,
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });

  const cookie = createCookie(SESSION_COOKIE_NAME, cookieValue, {
    maxAge: SESSION_TTL_SECONDS,
  });

  res.setHeader("Set-Cookie", cookie);
  res.redirect("https://www.strava.com/oauth/authorize?" + params.toString());
}
