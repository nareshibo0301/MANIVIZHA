const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createAppsScriptContext() {
  const rows = [];
  const secret = "s".repeat(32);
  const sheet = {
    name: "Sheet1",
    getLastRow: () => rows.length,
    setName(name) { this.name = name; },
    setFrozenRows() {},
    getRange(row, column, rowCount, columnCount) {
      return {
        setValues(values) {
          values.forEach((value, offset) => {
            rows[row - 1 + offset] = value.slice();
          });
        },
        getDisplayValues() {
          return rows.slice(row - 1, row - 1 + rowCount).map(values =>
            values.slice(column - 1, column - 1 + columnCount).map(String)
          );
        },
        setNumberFormat() {},
        setFontWeight() {}
      };
    }
  };
  const spreadsheet = {
    sheets: [sheet],
    getSheetByName(name) { return this.sheets.find(item => item.name === name) || null; },
    getSheets() { return this.sheets; },
    insertSheet(name) {
      const newSheet = { ...sheet, name };
      this.sheets.push(newSheet);
      return newSheet;
    }
  };
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
    SpreadsheetApp: { openById: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "google-apps-script", "Code.gs"), "utf8");
  vm.runInNewContext(source, context);
  return { context, rows, secret };
}

function post(context, secret, responses) {
  const output = context.doPost({ postData: { contents: JSON.stringify({ secret, responses }) } });
  return JSON.parse(output.text);
}

test("Apps Script initializes headers and appends response IDs only once", () => {
  const { context, rows, secret } = createAppsScriptContext();
  context.setup();
  assert.equal(rows[0][0], "Response ID");

  const response = {
    responseId: "42",
    createdAt: "2026-12-01T10:00:00.000Z",
    name: "Guest",
    phone: "+91 98765 43210",
    phoneNormalized: "9876543210",
    attending: "Yes"
  };
  assert.deepEqual(post(context, secret, [response]), { ok: true, inserted: 1, skipped: 0 });
  assert.deepEqual(post(context, secret, [response]), { ok: true, inserted: 0, skipped: 1 });
  assert.equal(rows.length, 2);
});

test("Apps Script rejects requests with an invalid webhook secret", () => {
  const { context, rows } = createAppsScriptContext();
  const response = post(context, "wrong", [{
    responseId: "42",
    createdAt: "2026-12-01T10:00:00.000Z",
    name: "Guest",
    phone: "9876543210",
    phoneNormalized: "9876543210",
    attending: "Yes"
  }]);

  assert.deepEqual(response, { ok: false, error: "Unauthorized." });
  assert.equal(rows.length, 0);
});

test("Apps Script GET endpoint provides a health check", () => {
  const { context } = createAppsScriptContext();
  const output = context.doGet();
  assert.deepEqual(JSON.parse(output.text), {
    ok: true,
    service: "Manivizha RSVP Google Sheets webhook"
  });
});
