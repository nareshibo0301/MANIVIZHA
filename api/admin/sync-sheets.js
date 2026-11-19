const { ensureSchema, getSql } = require("../_db");
const { hasAdminSession, sameOrigin } = require("../_auth");
const { json, methodNotAllowed } = require("../_http");
const { syncResponses, toSheetResponse } = require("../_google-sheets");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin is not allowed." });

  try {
    if (!hasAdminSession(req)) return json(res, 401, { error: "Please sign in to sync responses." });
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT id, name, phone, phone_normalized, attending, created_at
      FROM responses
      ORDER BY id ASC
    `;
    const result = await syncResponses(rows.map(toSheetResponse));
    if (!result.configured) {
      return json(res, 503, { error: "Google Sheets is not configured for this deployment." });
    }
    return json(res, 200, { ok: true, total: rows.length, ...result });
  } catch (error) {
    console.error("Could not sync RSVP responses to Google Sheets.", error);
    const message = error.message.startsWith("Google Apps Script returned non-JSON")
      ? error.message
      : "Google Sheets sync failed. You can safely retry it from this dashboard.";
    return json(res, 502, { error: message });
  }
};
