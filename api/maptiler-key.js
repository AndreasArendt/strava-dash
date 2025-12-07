import { kv } from "@vercel/kv";
import { getStateFromRequest, STATE_TTL_SECONDS } from "../lib/state.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const state = getStateFromRequest(req);
    if (!state) return res.status(401).send("Missing session state.");

    const sessionKey = `atlo:session:${state}`;
    const session = await kv.get(sessionKey);
    if (!session) return res.status(401).send("Session expired; please authenticate.");

    const token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("No token; please authenticate first.");

    await kv.expire(sessionKey, STATE_TTL_SECONDS);

    const key = process.env.MAPTILER_API_KEY;
    if (!key) {
      return res.status(500).send("MAPTILER_API_KEY is not configured.");
    }

    return res.status(200).json({ key });
  } catch (err) {
    console.error("Maptiler key error:", err);
    return res.status(500).send("Internal error");
  }
}
