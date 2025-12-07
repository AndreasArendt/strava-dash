import { getKvClient } from "../lib/database.js";
import { getStateFromRequest, STATE_TTL_SECONDS } from "../lib/state.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    const kv = getKvClient();

    const state = getStateFromRequest(req);
    if (!state) return res.status(401).send("Missing session state.");

    const sessionKey = `atlo:session:${state}`;
    const session = await kv.get(sessionKey);
    if (!session) return res.status(401).send("Session expired; please authenticate.");
    await kv.expire(sessionKey, STATE_TTL_SECONDS);

    const token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("Token not found; please re-authenticate.");

    return res.status(200).json(token);
  } catch (err) {
    if (err?.message?.startsWith("Missing env vars:")) {
      return res.status(500).send(err.message);
    }
    console.log("Token read error:", err.message);
    return res.status(500).send("Internal error");
  }
}
