import { kv } from "@vercel/kv";
import { extractSessionFromCookie, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../lib/session.js";
import { readFileSync } from "node:fs";
import path from "node:path";

export const config = { runtime: "nodejs" };

const LOGO_DATA_URI = (() => {
  try {
    const logoPath = path.join(process.cwd(), "logo/atlo.png");
    const file = readFileSync(logoPath);
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return "https://atlo.vercel.app/logo/atlo.png";
  }
})();

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
    const cookieState = extractSessionFromCookie(req.cookies?.[SESSION_COOKIE_NAME]);

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
    await kv.expire(`atlo:session:${state}`, SESSION_TTL_SECONDS);

    res.status(200).send(`
      <!doctype html>
      <html lang="en">
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap" rel="stylesheet" />
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Atlo · Connected</title>
          <style>
            :root {
              color-scheme: light dark;
              font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: linear-gradient(135deg, #edf2f7, #f8fafc);
              color: #0f172a;
            }
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 32px 16px;
            }
            .card {
              background: rgba(255, 255, 255, 0.92);
              border: 1px solid rgba(15, 23, 42, 0.08);
              border-radius: 20px;
              padding: 32px 40px;
              text-align: center;
              box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
              max-width: 420px;
              width: 100%;
            }
            h2 {
              margin-top: 18px;
              margin-bottom: 10px;
              font-size: 28px;
            }
            p {
              margin: 0 0 12px;
              color: #475569;
            }
            .logo {
              width: 72px;
              height: 72px;
              border-radius: 18px;
              object-fit: contain;
            }
            button {
              margin-top: 18px;
              background: linear-gradient(135deg, #113c4c, #38acbd);
              color: #fff;
              border: none;
              border-radius: 999px;
              padding: 12px 24px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 12px 32px rgba(56, 172, 189, 0.35);
              transition: transform 120ms ease, box-shadow 120ms ease;
            }
            button:hover {
              transform: translateY(-1px);
            }
            button:active {
              transform: translateY(0);
              box-shadow: 0 8px 20px rgba(17, 60, 76, 0.4);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${LOGO_DATA_URI}" alt="Atlo logo" class="logo" />
            <h2>You're connected</h2>
            <p>You can close this window and return to Atlo. Your activities will refresh automatically.</p>
            <button onclick="window.close()">Close this window</button>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.log("Error in /api/strava:", err);
    res.status(500).send("Internal error");
  }
}
