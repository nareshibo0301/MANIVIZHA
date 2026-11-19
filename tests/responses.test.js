const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDashboardRows, getResponseStats, normalizePhone } = require("../api/_responses");

test("phone normalization matches Indian numbers with or without the country code", () => {
  assert.equal(normalizePhone("+91 98765-43210"), "9876543210");
  assert.equal(normalizePhone("98765 43210"), "9876543210");
});

test("dashboard defaults to the latest response per phone and can include duplicates", () => {
  const rows = [
    { id: 2, name: "Latest", phone: "+91 98765 43210", phone_normalized: "9876543210", attending: "No", created_at: "2026-12-01T10:00:00Z" },
    { id: 1, name: "Earlier", phone: "9876543210", phone_normalized: "9876543210", attending: "Yes", created_at: "2026-12-01T09:00:00Z" },
    { id: 3, name: "Other", phone: "9123456789", phone_normalized: "9123456789", attending: "Yes", created_at: "2026-12-01T08:00:00Z" }
  ];

  const latest = buildDashboardRows(rows, false);
  assert.deepEqual(latest.map(row => row.name), ["Latest", "Other"]);
  assert.equal(latest[0].duplicateCount, 1);

  const all = buildDashboardRows(rows, true);
  assert.deepEqual(all.map(row => row.isDuplicate), [false, true, false]);
  assert.deepEqual(getResponseStats(rows), {
    totalResponses: 3,
    uniqueGuests: 2,
    duplicateResponses: 1,
    attendingYes: 2,
    attendingNo: 1
  });
});

test("responses without phone numbers are counted separately, not as duplicates", () => {
  const rows = [
    { id: 2, name: "First guest", phone: "", phone_normalized: "", attending: "Yes", created_at: "2026-12-01T10:00:00Z" },
    { id: 1, name: "Second guest", phone: "", phone_normalized: "", attending: "Yes", created_at: "2026-12-01T09:00:00Z" }
  ];

  assert.equal(buildDashboardRows(rows, false).length, 2);
  assert.deepEqual(getResponseStats(rows), {
    totalResponses: 2,
    uniqueGuests: 2,
    duplicateResponses: 0,
    attendingYes: 2,
    attendingNo: 0
  });
});
