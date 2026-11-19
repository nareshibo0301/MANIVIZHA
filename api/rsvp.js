const { ensureSchema, getSql } = require("./_db");
const { json } = require("./_http");
const { normalizePhone } = require("./_responses");
const { sameOrigin } = require("./_auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed." });
  }
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin is not allowed." });
  if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
    return json(res, 415, { error: "Send the response as JSON." });
  }

  const input = req.body && typeof req.body === "object" ? req.body : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const attending = input.attending;
  const normalizedPhone = normalizePhone(phone);
  if (name.length < 2 || name.length > 120 || normalizedPhone.length < 7 ||
      normalizedPhone.length > 15 || !/^[+\d\s()-]+$/.test(phone) ||
      !["Yes", "No"].includes(attending)) {
    return json(res, 400, { error: "Please provide a valid name, phone number, and attendance choice." });
  }

  try {
    const sql = getSql();
    await ensureSchema(sql);
    await sql`
      INSERT INTO responses (name, phone, phone_normalized, attending)
      VALUES (${name}, ${phone}, ${normalizedPhone}, ${attending})
    `;
    return json(res, 201, { ok: true });
  } catch (error) {
    console.error("Could not save RSVP response.", error);
    return json(res, 500, { error: "We could not save your response. Please try again." });
  }
};
