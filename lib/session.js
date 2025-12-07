import crypto from "node:crypto";
import { getKvClient } from "./database.js";

export async function createSession(ttlSeconds = 60 * 10) {
  const state = crypto.randomBytes(16).toString("hex");
  const data = { state, issuedAt: Date.now() };
  const kv = getKvClient();
  await kv.set(`atlo:session:${state}`, data, { ex: ttlSeconds });
  return { state, expiresAt: Date.now() + ttlSeconds * 1000 };
}
