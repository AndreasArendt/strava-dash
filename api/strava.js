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
    // Fail fast if required env vars are missing to avoid generic 500s
    const missing = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "KV_REST_API_URL", "KV_REST_API_TOKEN"].filter(
      (k) => !process.env[k]
    );
    if (missing.length) {
      return res.status(500).send(`Missing env vars: ${missing.join(", ")}`);
    }

    const { code, state } = req.query;
    const cookieState = getCookie(req, "strava_state");

    if (!state || !cookieState || state !== cookieState) {
      return res
        .status(400)
        .send("Invalid or missing state. Please restart the authentication.");
    }

    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const msg = await tokenResponse.text();
      return res.status(502).send(`Token exchange failed: ${msg}`);
    }

    const token = await tokenResponse.json();

    // Persist per-user token securely with a reasonable TTL (30 days)
    const ttlSeconds = 60 * 60 * 24 * 30;
    await kv.set(`strava:token:${state}`, token, { ex: ttlSeconds });

    res.status(200).send(`
      <html><body>
      <h2>Authentication successful!</h2>
      <p>You can close this window and return to the app.</p>
      </body></html>
    `);
  } catch (err) {
    console.log("Error in /api/strava:", err);
    res.status(500).send("Internal error");
  }
}
