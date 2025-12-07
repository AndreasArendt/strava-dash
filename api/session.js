import { createSession } from "../lib/session";
import { buildStateCookieValue, STATE_COOKIE_NAME, STATE_TTL_SECONDS } from "../lib/state.js";
import { createCookie } from "../lib/cookie.js";

export default async function handler(req, res) {
  try {
    const session = await createSession();
    const cookieValue = buildStateCookieValue(session.state);

    const cookie = createCookie(STATE_COOKIE_NAME, cookieValue, {
      maxAge: STATE_TTL_SECONDS,
      sameSite: "Lax"
    });

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ state: session.state, expiresAt: session.expiresAt });
  } catch (err) {
    console.error("Session creation error:", err);
    return res.status(500).send("Internal session error");
  }
}
