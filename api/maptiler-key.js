import { kv } from "@vercel/kv";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  try {
    const state = req.cookies?.strava_state;
    if (!state) return res.status(401).send("Missing session state.");

    const token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("No token; please authenticate first.");

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
