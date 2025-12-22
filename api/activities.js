import { rateLimit, getStravaContext } from "../lib/api.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const allowed = await rateLimit(req, res);
  if (!allowed) return;
  try {
    const ctx = await getStravaContext(req, res);
    if (!ctx) return;

    const { token } = ctx;

    const simplified = await queryActivities(token, req, res);

    return res.status(200).json(simplified);
  } catch (err) {
    console.log("Error in /api/activities:", err.message);
    return res.status(500).send("Internal error");
  }
}

async function buildBaseParams(req) {
  const nowDate = new Date();
  const defaultAfter = new Date(nowDate);
  defaultAfter.setFullYear(defaultAfter.getFullYear() - 1);

  const toUnix = (value, fallback) => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? fallback
      : Math.floor(parsed.getTime() / 1000);
  };

  const afterSeconds = toUnix(
    req.query.after,
    Math.floor(defaultAfter.getTime() / 1000)
  );
  const beforeSeconds = toUnix(
    req.query.before,
    Math.floor(nowDate.getTime() / 1000)
  );

  const baseParams = new URLSearchParams();
  if (afterSeconds) baseParams.set("after", afterSeconds.toString());
  if (beforeSeconds && beforeSeconds > afterSeconds) {
    baseParams.set("before", beforeSeconds.toString());
  }

  return baseParams;
}

async function queryActivities(token, req, res) {
  let baseParams = await buildBaseParams(req);

  const perPage = 200;
  let page = 1;
  const simplified = [];

  while (true) {
    const params = new URLSearchParams(baseParams);
    params.set("page", page.toString());
    params.set("per_page", perPage.toString());

    const resp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }
    );

    if (!resp.ok) {
      const msg = await resp.text();
      return res.status(502).send(`Activities fetch failed: ${msg}`);
    }

    const data = await resp.json();
    simplified.push(
      ...data
        .map((a) => ({
          polyline: a.map.summary_polyline,
          type: a.type,
          name: a.name,
          id: a.id,
          date: a.start_date,
          distance: a.distance || 0,
          movingTime: a.moving_time || a.elapsed_time || 0,
          elevationGain: a.total_elevation_gain || 0,
          gear_id: a.gear_id,
          hasMapdata: Boolean(a.map && a.map.summary_polyline)
        }))
    );

    if (data.length < perPage) break;
    page += 1;
  }

  return simplified;
}
