import crypto from "node:crypto";
import { getKvClient } from "./database.js";

export const SESSION_COOKIE_NAME = "atlo_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function signSessionValue(session) {
  const hmac = crypto.createHmac("sha256", process.env.STRAVA_CLIENT_SECRET);
  hmac.update(session);
  return hmac.digest("base64url");
}

export function buildSessionCookieValue(session) {
  return `${session}.${signSessionValue(session)}`;
}

export function extractSessionFromCookie(cookieValue) {
  if (!cookieValue) return null;
  const [session, signature] = cookieValue.split(".");
  if (!session || !signature) return null;
  try {
    const expected = signSessionValue(session);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req) {
  return extractSessionFromCookie(req.cookies?.[SESSION_COOKIE_NAME]);
}

export async function createSession(ttlSeconds = SESSION_TTL_SECONDS) {
  const state = crypto.randomBytes(16).toString("hex");
  const kv = getKvClient();
  await kv.set(`atlo:session:${state}`, { issuedAt: Date.now() }, { ex: ttlSeconds });
  return { state, expiresAt: Date.now() + ttlSeconds * 1000 };
}
