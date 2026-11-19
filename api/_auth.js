const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "manivizha_admin";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

function safeEqual(left, right) {
  const leftHash = createHmac("sha256", "manivizha-constant-time").update(left).digest();
  const rightHash = createHmac("sha256", "manivizha-constant-time").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function createSessionToken(secret, now = Date.now()) {
  const payload = `${now}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload, secret)}`;
}

function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) {
    return false;
  }

  const issuedAt = Number(parts[0]);
  const age = now - issuedAt;
  if (!Number.isSafeInteger(issuedAt) || age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret), "hex");
  const actual = Buffer.from(parts[2], "hex");
  return timingSafeEqual(expected, actual);
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return "";
}

function hasAdminSession(req) {
  return verifySessionToken(getCookie(req, COOKIE_NAME), getSessionSecret());
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host;
  if (!host) return false;

  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  hasAdminSession,
  safeEqual,
  sameOrigin,
  sessionCookie,
  verifySessionToken
};
