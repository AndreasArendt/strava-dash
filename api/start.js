import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { buildSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../lib/session.js";
import { createCookie } from "../lib/cookie.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res
      .status(500)
      .send(
        "Missing STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET environment variables."
      );
  }

  const state = crypto.randomBytes(16).toString("hex");
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

  await kv.set(`atlo:session:${state}`, { issuedAt: Date.now() }, { ex: SESSION_TTL_SECONDS });

  res.redirect("https://www.strava.com/oauth/authorize?" + params.toString());
}
