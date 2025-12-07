import { createClient } from "@vercel/kv";

let cachedKv;

export function getKvClient() {
  if (cachedKv) return cachedKv;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_ONLY_TOKEN;
  const missing = [];
  if (!url) missing.push("KV_REST_API_URL");
  if (!token) missing.push("KV_REST_API_TOKEN (or KV_REST_API_READ_ONLY_TOKEN)");

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  cachedKv = createClient({ url, token });
  return cachedKv;
}