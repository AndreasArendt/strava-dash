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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  try {
    const kv = getKvClient();
    let state = getSessionFromRequest(req);
    let expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;

    if (state) {
      const sessionKey = `atlo:session:${state}`;
      const existing = await kv.get(sessionKey);
      if (!existing) {
        const session = await createSession(SESSION_TTL_SECONDS);
        state = session.state;
        expiresAt = session.expiresAt;
      } else {
        await kv.expire(sessionKey, SESSION_TTL_SECONDS);
      }
    } else {
      const session = await createSession(SESSION_TTL_SECONDS);
      state = session.state;
      expiresAt = session.expiresAt;
    }

    const cookieValue = buildSessionCookieValue(state);
    const cookie = createCookie(SESSION_COOKIE_NAME, cookieValue, {
      maxAge: SESSION_TTL_SECONDS,
      sameSite: "Lax"
    });

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ state, expiresAt });
  } catch (err) {
    console.error("Session creation error:", err);
    return res.status(500).send("Internal session error");
  }
}
