const test = require("node:test");
const assert = require("node:assert/strict");
const { createSessionToken } = require("../api/_auth");
const handler = require("../api/admin/update-invitation");

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function callHandler({ body, fetchImpl, session = true }) {
  const originalFetch = global.fetch;
  const originalSecret = process.env.ADMIN_SESSION_SECRET;
  const originalToken = process.env.GITHUB_TOKEN;
  const originalBranch = process.env.GITHUB_BRANCH;
  process.env.ADMIN_SESSION_SECRET = "test-secret-".padEnd(32, "x");
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = fetchImpl;
  const cookie = session
    ? `manivizha_admin=${createSessionToken(process.env.ADMIN_SESSION_SECRET)}`
    : "";
  const req = {
    method: "POST",
    body,
    headers: { cookie, origin: "https://manivizha.test", host: "manivizha.test" }
  };
  const res = createResponse();
  try {
    await handler(req, res);
    return res;
  } finally {
    global.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalSecret;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    if (originalBranch === undefined) delete process.env.GITHUB_BRANCH;
    else process.env.GITHUB_BRANCH = originalBranch;
  }
}

test("admin can replace a language invitation with a PNG GitHub commit", async () => {
  const png = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    Buffer.from("invitation-image")
  ]);
  const calls = [];
  const response = await callHandler({
    body: { language: "tamil", image: png.toString("base64") },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "PUT") {
        return new Response(JSON.stringify({ commit: { sha: "1234567890abcdef" } }), { status: 201 });
      }
      return new Response(JSON.stringify({ sha: "existing-image-sha" }), { status: 200 });
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, language: "Tamil", commit: "1234567" });
  assert.match(calls[0].url, /\/contents\/TAMIL\.png\?ref=main$/);
  assert.equal(calls[1].options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    message: "Update Tamil invitation image from admin dashboard",
    content: png.toString("base64"),
    branch: "main",
    sha: "existing-image-sha"
  });
});

test("admin invitation updates reject invalid images before contacting GitHub", async () => {
  let contactedGitHub = false;
  const response = await callHandler({
    body: { language: "english", image: Buffer.from("not a PNG").toString("base64") },
    fetchImpl: async () => { contactedGitHub = true; }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /valid PNG/);
  assert.equal(contactedGitHub, false);
});

test("admin invitation updates require an authenticated session", async () => {
  let contactedGitHub = false;
  const response = await callHandler({
    body: { language: "english", image: "aGVsbG8=" },
    session: false,
    fetchImpl: async () => { contactedGitHub = true; }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(contactedGitHub, false);
});
