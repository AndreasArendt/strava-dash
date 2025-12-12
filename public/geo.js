import { vec3, mat3 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.4/+esm";

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;
const WGS84_EP2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}

function ecefPointToWgs84(point) {
  if (!Array.isArray(point) || point.length < 3) return null;
  const [x, y, z] = point;
  if (![x, y, z].every((val) => Number.isFinite(val))) return null;

  const a = WGS84_A;
  const e2 = WGS84_E2;
  const b = WGS84_B;
  const ep2 = WGS84_EP2;

  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  if (p === 0 && z === 0) {
    return {
      lat_rad: 0,
      lon_rad: 0,
      lat_deg: 0,
      lon_deg: 0,
      height_m: -a,
    };
  }

  const theta = Math.atan2(z * a, p * b);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  const lat = Math.atan2(
    z + ep2 * b * sinTheta * sinTheta * sinTheta,
    p - e2 * a * cosTheta * cosTheta * cosTheta
  );

  const sinLat = Math.sin(lat);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const h = p / Math.cos(lat) - N;

  return {
    lat_rad: lat,
    lon_rad: lon,
    lat_deg: radiansToDegrees(lat),
    lon_deg: radiansToDegrees(lon),
    height_m: h
  };
}

export function ecefToWgs84(points) {
  if (!Array.isArray(points)) return [];
  const isSinglePoint =
    Number.isFinite(points[0]) &&
    Number.isFinite(points[1]) &&
    Number.isFinite(points[2]);

  if (isSinglePoint) {
    const result = ecefPointToWgs84(points);
    return result ? [result] : [];
  }

  return points.map(ecefPointToWgs84).filter(Boolean);
}

/**
 * Convert latitude/longitude/altitude points (degrees/meters) to ECEF coordinates.
 * @param {Array<[number, number, number?]>} points
 * @returns {Array<[number, number, number]>}
 */
export function wgs84_to_ecef(points = []) {
  if (!Array.isArray(points)) return [];

  return points
    .map(([latDeg, lonDeg, alt__m = 0]) => {
      if (
        !Number.isFinite(latDeg) ||
        !Number.isFinite(lonDeg) ||
        !Number.isFinite(alt__m)
      ) {
        return null;
      }

      const lat = degreesToRadians(latDeg);
      const lon = degreesToRadians(lonDeg);
      const sinLat = Math.sin(lat);
      const cosLat = Math.cos(lat);
      const sinLon = Math.sin(lon);
      const cosLon = Math.cos(lon);
      const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

      const x = (N + alt__m) * cosLat * cosLon;
      const y = (N + alt__m) * cosLat * sinLon;
      const z = (N * (1 - WGS84_E2) + alt__m) * sinLat;
      return [x, y, z];
    })
    .filter(Boolean);
}

// Interpolation / Spline functions
export function catmullRomSpline(points, samplesPerSegment = 10, alpha = 0.5) {
  if (points.length < 4) return points;

  const result = [];

  function tj(ti, pi, pj) {
    const dx = pj.x - pi.x;
    const dy = pj.y - pi.y;
    return Math.pow(Math.hypot(dx, dy), alpha) + ti;
  }

  for (let i = 0; i < points.length - 3; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const p2 = points[i + 2];
    const p3 = points[i + 3];

    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);

    for (let j = 0; j <= samplesPerSegment; j++) {
      const t = t1 + (j / samplesPerSegment) * (t2 - t1);

      const A1 = lerp(p0, p1, (t - t0) / (t1 - t0));
      const A2 = lerp(p1, p2, (t - t1) / (t2 - t1));
      const A3 = lerp(p2, p3, (t - t2) / (t3 - t2));

      const B1 = lerp(A1, A2, (t - t0) / (t2 - t0));
      const B2 = lerp(A2, A3, (t - t1) / (t3 - t1));

      const C = lerp(B1, B2, (t - t1) / (t2 - t1));
      result.push(C);
    }
  }

  return result;
}

function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}