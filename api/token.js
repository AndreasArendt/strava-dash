import { kv } from "@vercel/kv";

export const config = { runtime: "nodejs" };

function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies[name];
}

export default async function handler(req, res) {
  try {
    const missing = ["KV_REST_API_URL", "KV_REST_API_TOKEN"].filter((k) => !process.env[k]);
    if (missing.length) {
      return res.status(500).send(`Missing env vars: ${missing.join(", ")}`);
    }

    const state = getCookie(req, "strava_state");
    if (!state) return res.status(401).send("Missing session state.");

    const token = await kv.get(`strava:token:${state}`);
    if (!token) return res.status(404).send("Token not found; please re-authenticate.");

    return res.status(200).json(token);
  } catch (err) {
    console.log("Token read error:", err.message);
    return res.status(500).send("Internal error");
  }
}
