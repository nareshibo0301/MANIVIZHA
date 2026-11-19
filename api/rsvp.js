const { ensureSchema, getSql } = require("./_db");
const { json } = require("./_http");
const { parseRsvpInput } = require("./_rsvp-input");
const { sameOrigin } = require("./_auth");
const { syncResponses, toSheetResponse } = require("./_google-sheets");

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

  const responseInput = parseRsvpInput(req.body);
  if (!responseInput) {
    return json(res, 400, { error: "Please provide a valid name, optional phone number, and RSVP confirmation." });
  }
  const { name, phone, normalizedPhone, attending } = responseInput;

  try {
    const sql = getSql();
    await ensureSchema(sql);
    const [savedResponse] = await sql`
      INSERT INTO responses (name, phone, phone_normalized, attending)
      VALUES (${name}, ${phone}, ${normalizedPhone}, ${attending})
      RETURNING id, name, phone, phone_normalized, attending, created_at
    `;
    let sheetSyncMessage;
    try {
      const result = await syncResponses([toSheetResponse(savedResponse)]);
      if (!result.configured) {
        sheetSyncMessage = "Your reply is saved, but the spreadsheet has not been connected yet.";
      }
    } catch (error) {
      console.error("Could not sync an RSVP response to Google Sheets.", error);
      sheetSyncMessage = "Your reply is saved, but the spreadsheet update is pending. The organizer can safely retry it.";
    }
    return json(res, 201, { ok: true, sheetSynced: !sheetSyncMessage, sheetSyncMessage });
  } catch (error) {
    console.error("Could not save RSVP response.", error);
    return json(res, 500, { error: "We could not save your response. Please try again." });
  }
};
