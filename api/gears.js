import { rateLimit, getStravaContext } from "../lib/api.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const allowed = await rateLimit(req, res);
  if (!allowed) return;

  try {
    const ctx = await getStravaContext(req, res);
    if (!ctx) return;

    const { token } = ctx;

    const gearIDs = parseGearIds(req);
    if (!gearIDs.length) {
      return res.status(400).json({ message: "No gear ids provided." });
    }

    const simplified = await queryGear(token, gearIDs, req, res);

    return res.status(200).json(simplified);
  } catch (err) {
    console.log("Error in /api/gears:", err.message);
    return res.status(500).send("Internal error");
  }
}

function parseGearIds(req) {
  const rawIds = req.query?.id || req.query?.ids || [];
  if (Array.isArray(rawIds)) {
    return rawIds.filter(Boolean);
  }
  if (typeof rawIds === "string") {
    return rawIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [];
}

async function queryGear(token, gearIDs, req, res) {
  const simplified = [];

  for (const gearID of gearIDs) {
    const allowed = await rateLimit(req, res);
    if (!allowed) return; // stop processing entirely if rate-limited

    const resp = await fetch(
      `https://www.strava.com/api/v3/gear/${gearID}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      }
    );

    if (!resp.ok) {
      const msg = await resp.text();
      return res.status(502).send(`Gear fetch failed: ${msg}`);
    }

    const data = await resp.json();

    simplified.push({
      id: data.id,
      distance: data.distance,
      brand_name: data.brand_name,
      model_name: data.model_name,
    });
  }

  return simplified;
}
