export function createCookie(name, value, { maxAge, httpOnly = true, sameSite = "Lax", secure } = {}) {
  const isLocal =
    process.env.VERCEL_ENV === "development" ||
    process.env.NODE_ENV === "development";

  const parts = [`${name}=${value}`, "Path=/"];

  if (httpOnly) parts.push("HttpOnly");
  if (sameSite) parts.push(`SameSite=${sameSite}`);

  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (!isLocal || secure) parts.push("Secure");

  return parts.join("; ");
}
