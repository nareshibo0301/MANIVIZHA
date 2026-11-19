const { json, methodNotAllowed } = require("../_http");
const { safeEqual, sameOrigin, sessionCookie, createSessionToken } = require("../_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin is not allowed." });

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    console.error("ADMIN_PASSWORD is not configured.");
    return json(res, 500, { error: "Dashboard authentication is not configured." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(password, configuredPassword)) {
    return json(res, 401, { error: "Incorrect password." });
  }

  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error("ADMIN_SESSION_SECRET must contain at least 32 bytes.");
    }
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(secret)));
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("Could not create dashboard session.", error);
    return json(res, 500, { error: "Dashboard authentication is not configured." });
  }
};
