const SPREADSHEET_ID = "1YVbfs46aowO94AAjT4j4uYgnoc_szhQ4Dnu5OwOvt3s";
const RESPONSE_SHEET_NAME = "Responses";
const RESPONSE_HEADERS = [
  "Response ID",
  "Submitted At (UTC)",
  "Name",
  "Phone",
  "Normalized Phone",
  "Celebration Reply"
];

function setup() {
  const sheet = getResponseSheet_();
  sheet.setFrozenRows(1);
  return "Responses sheet is ready.";
}

function doGet() {
  return jsonOutput_({ ok: true, service: "Manivizha RSVP Google Sheets webhook" });
}

function doPost(event) {
  const properties = PropertiesService.getScriptProperties();
  const configuredSecret = properties.getProperty("GOOGLE_SHEETS_WEBHOOK_SECRET");
  if (!configuredSecret) return jsonOutput_({ ok: false, error: "Webhook secret is not configured." });

  let request;
  try {
    request = JSON.parse(event.postData.contents);
  } catch {
    return jsonOutput_({ ok: false, error: "Request body must be valid JSON." });
  }
  if (typeof request.secret !== "string" || request.secret !== configuredSecret) {
    return jsonOutput_({ ok: false, error: "Unauthorized." });
  }
  if (!Array.isArray(request.responses) || request.responses.length > 500) {
    return jsonOutput_({ ok: false, error: "Send between 1 and 500 responses." });
  }

  const responses = request.responses.map(validateResponse_);
  if (responses.some(response => response === null)) {
    return jsonOutput_({ ok: false, error: "One or more responses are invalid." });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getResponseSheet_();
    const lastRow = sheet.getLastRow();
    const existingIds = new Set();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().forEach(row => existingIds.add(row[0]));
    }

    const rows = responses
      .filter(response => !existingIds.has(response.responseId))
      .map(toSheetRow_);
    if (rows.length) {
      const range = sheet.getRange(lastRow + 1, 1, rows.length, RESPONSE_HEADERS.length);
      range.setNumberFormat("@");
      range.setValues(rows);
    }

    return jsonOutput_({
      ok: true,
      inserted: rows.length,
      skipped: responses.length - rows.length
    });
  } catch (error) {
    console.error("Could not append RSVP responses.", error);
    return jsonOutput_({ ok: false, error: "Could not write responses to the spreadsheet." });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) {
    const sheets = spreadsheet.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName(RESPONSE_SHEET_NAME);
    } else {
      sheet = spreadsheet.insertSheet(RESPONSE_SHEET_NAME);
    }
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
    sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    const headers = sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).getDisplayValues()[0];
    if (RESPONSE_HEADERS.some((header, index) => headers[index] !== header)) {
      throw new Error("The Responses sheet has unexpected column headers.");
    }
  }
  return sheet;
}

function validateResponse_(response) {
  if (!response || typeof response !== "object") return null;
  const { responseId, createdAt, name, phone, phoneNormalized, attending } = response;
  if (typeof responseId !== "string" || !/^\d+$/.test(responseId) ||
      typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt)) ||
      typeof name !== "string" || name.trim().length < 2 || name.length > 120 ||
      typeof phone !== "string" || !/^[+\d\s()-]{7,30}$/.test(phone) ||
      typeof phoneNormalized !== "string" || !/^\d{7,15}$/.test(phoneNormalized) ||
      !["Yes", "No"].includes(attending)) {
    return null;
  }
  return { responseId, createdAt, name: name.trim(), phone, phoneNormalized, attending };
}

function toSheetRow_(response) {
  return [
    response.responseId,
    response.createdAt,
    response.name,
    response.phone,
    response.phoneNormalized,
    response.attending
  ].map(asPlainText_);
}

function asPlainText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
