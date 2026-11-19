const { ensureSchema, getSql } = require("./_db");
const { json, methodNotAllowed } = require("./_http");
const { hasAdminSession } = require("./_auth");
const { buildDashboardRows, getResponseStats } = require("./_responses");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    if (!hasAdminSession(req)) return json(res, 401, { error: "Please sign in to view responses." });
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT id, name, phone, phone_normalized, attending, created_at
      FROM responses
      ORDER BY created_at DESC, id DESC
    `;
    const includeDuplicates = req.query?.includeDuplicates === "1";
    return json(res, 200, {
      stats: getResponseStats(rows),
      responses: buildDashboardRows(rows, includeDuplicates)
    });
  } catch (error) {
    console.error("Could not load RSVP responses.", error);
    return json(res, 500, { error: "We could not load responses. Please try again." });
  }
};
