const { json, methodNotAllowed } = require("../_http");
const { sameOrigin, sessionCookie } = require("../_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin is not allowed." });
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  return json(res, 200, { ok: true });
};
