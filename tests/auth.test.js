const test = require("node:test");
const assert = require("node:assert/strict");
const { createSessionToken, verifySessionToken } = require("../api/_auth");

test("admin session tokens verify only with their secret and within their lifetime", () => {
  const secret = "a".repeat(32);
  const now = 1_800_000_000_000;
  const token = createSessionToken(secret, now);

  assert.equal(verifySessionToken(token, secret, now + 60_000), true);
  assert.equal(verifySessionToken(token, "b".repeat(32), now + 60_000), false);
  assert.equal(verifySessionToken(token, secret, now + 8 * 60 * 60 * 1000 + 1), false);
  assert.equal(verifySessionToken(`${token.slice(0, -1)}0`, secret, now + 60_000), false);
});
