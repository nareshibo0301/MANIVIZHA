const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRsvpInput } = require("../api/_rsvp-input");

test("RSVP accepts a missing phone number", () => {
  assert.deepEqual(parseRsvpInput({ name: "Guest Name", attending: "Yes" }), {
    name: "Guest Name",
    phone: "",
    normalizedPhone: "",
    attending: "Yes"
  });
});

test("RSVP validates a supplied phone number and rejects invalid values", () => {
  assert.equal(parseRsvpInput({ name: "Guest Name", phone: "abc", attending: "Yes" }), null);
  assert.equal(parseRsvpInput({ name: "Guest Name", phone: "98765 43210", attending: "Yes" }).normalizedPhone, "9876543210");
});

test("RSVP only accepts confirmation", () => {
  assert.equal(parseRsvpInput({ name: "Guest Name", phone: "", attending: "No" }), null);
});
