const test = require("node:test");
const assert = require("node:assert/strict");
const { syncResponses } = require("../api/_google-sheets");

const originalUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const originalSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
const originalFetch = global.fetch;

test.after(() => {
  if (originalUrl === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  else process.env.GOOGLE_SHEETS_WEBHOOK_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  else process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = originalSecret;
  global.fetch = originalFetch;
});

test("Google Sheets sync reports when the webhook is not configured", async () => {
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  assert.deepEqual(await syncResponses([{ responseId: "1" }]), {
    configured: false,
    inserted: 0,
    skipped: 0
  });
});

test("Google Sheets sync sends server-side credentials and returns append totals", async () => {
  process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/test/exec";
  process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = "x".repeat(32);
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true, inserted: 2, skipped: 1 }) };
  };

  const result = await syncResponses([{ responseId: "1" }, { responseId: "2" }, { responseId: "3" }]);
  assert.deepEqual(result, { configured: true, inserted: 2, skipped: 1 });
  assert.equal(request.url, process.env.GOOGLE_SHEETS_WEBHOOK_URL);
  assert.deepEqual(JSON.parse(request.options.body), {
    secret: "x".repeat(32),
    responses: [{ responseId: "1" }, { responseId: "2" }, { responseId: "3" }]
  });
});

test("Google Sheets sync surfaces a rejected webhook response", async () => {
  process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/test/exec";
  process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = "x".repeat(32);
  global.fetch = async () => ({ ok: true, json: async () => ({ ok: false, error: "Unauthorized." }) });

  await assert.rejects(syncResponses([{ responseId: "1" }]), /Unauthorized/);
});
