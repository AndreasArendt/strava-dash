import crypto from "node:crypto";
import { kv } from "@vercel/kv";
import { buildStateCookieValue, STATE_COOKIE_NAME, STATE_TTL_SECONDS } from "../lib/state.js";
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
  const cookieValue = buildStateCookieValue(state);

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.BASE_URL}/api/strava`,
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });

  const cookie = createCookie(STATE_COOKIE_NAME, cookieValue, {
    maxAge: STATE_TTL_SECONDS,
  });

  res.setHeader("Set-Cookie", cookie);

  await kv.set(`atlo:session:${state}`, { issuedAt: Date.now() }, { ex: STATE_TTL_SECONDS });

  res.redirect("https://www.strava.com/oauth/authorize?" + params.toString());
}
