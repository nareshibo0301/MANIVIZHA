const BATCH_SIZE = 200;

function getConfig() {
  const endpoint = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!endpoint || !secret) return null;

  const url = new URL(endpoint);
  if (url.protocol !== "https:" ||
      !["script.google.com", "script.googleusercontent.com"].includes(url.hostname)) {
    throw new Error("GOOGLE_SHEETS_WEBHOOK_URL must be an HTTPS Google Apps Script URL.");
  }
  if (Buffer.byteLength(secret) < 32) {
    throw new Error("GOOGLE_SHEETS_WEBHOOK_SECRET must contain at least 32 bytes.");
  }
  return { endpoint: url.toString(), secret };
}

async function syncResponses(responses) {
  const config = getConfig();
  if (!config) return { configured: false, inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  for (let offset = 0; offset < responses.length; offset += BATCH_SIZE) {
    const batch = responses.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, responses: batch }),
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Google Sheets returned an invalid response.");
    }
    if (!response.ok || result.ok !== true) {
      throw new Error(typeof result.error === "string" ? result.error : "Google Sheets rejected the sync.");
    }
    inserted += Number(result.inserted) || 0;
    skipped += Number(result.skipped) || 0;
  }

  return { configured: true, inserted, skipped };
}

function toSheetResponse(row) {
  return {
    responseId: String(row.id),
    createdAt: new Date(row.created_at).toISOString(),
    name: row.name,
    phone: row.phone,
    phoneNormalized: row.phone_normalized,
    attending: row.attending
  };
}

module.exports = { getConfig, syncResponses, toSheetResponse };
