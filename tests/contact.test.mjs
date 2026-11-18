import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Exercise the actual TypeScript modules with the installed compiler, without
// adding a runner dependency or writing compiled artifacts into the repository.
function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const validationUrl = moduleUrl(await readFile(new URL("../src/lib/contact/validation.ts", import.meta.url), "utf8"));
const { validateInquiry, fieldLimits } = await import(validationUrl);
const serverSource = await readFile(new URL("../src/lib/contact/server.ts", import.meta.url), "utf8");
const { handleContact } = await import(moduleUrl(serverSource.replace('"./validation"', JSON.stringify(validationUrl))));
const valid = { name: "Test Person", email: "visitor@example.org", inquiryType: "Freelance Project", subject: "A project question", message: "Please discuss this test project.", website: "" };
const env = { NODE_ENV: "production", CONTACT_ALLOWED_ORIGIN: "https://portfolio.example.org", RESEND_API_KEY: "test-only-token", CONTACT_FROM_EMAIL: "sender@example.org", CONTACT_TO_EMAIL: "owner@example.org", UPSTASH_REDIS_REST_URL: "https://test.upstash.io", UPSTASH_REDIS_REST_TOKEN: "test-only-redis-token" };
const request = (body = valid, headers = {}) => new Request("https://portfolio.example.org/api/contact", {
  method: "POST", headers: { Origin: env.CONTACT_ALLOWED_ORIGIN, "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const noNetwork = async () => { throw new Error("Unexpected network call"); };
function services({ count = 1, redisStatus = 200, redisBody, emailStatus = 200, emailBody = { id: "mock-accepted-id" }, fail = false } = {}) {
  const calls = [];
  const send = async (url, init) => {
    calls.push({ url, init });
    if (fail) throw new Error("Mock network outage");
    return url.includes("upstash.io") ? Response.json(redisBody ?? { result: count }, { status: redisStatus }) : Response.json(emailBody, { status: emailStatus });
  };
  return { calls, send };
}

test("required fields and types are rejected", () => {
  for (const field of Object.keys(fieldLimits)) {
    for (const value of [undefined, null, 7, [], {}, "", "   "]) {
      const result = validateInquiry({ ...valid, [field]: value });
      assert.equal(result.ok, false);
      assert.ok(result.errors[field]);
    }
  }
});
test("field length limits, email injection, and inquiry enum are enforced", () => {
  for (const [field, limit] of Object.entries(fieldLimits)) assert.equal(validateInquiry({ ...valid, [field]: "x".repeat(limit + 1) }).ok, false);
  for (const email of ["bad", "one@example.org,two@example.org", "one@example.org\r\nBcc: another@example.org", "Name <one@example.org>"]) assert.equal(validateInquiry({ ...valid, email }).ok, false);
  assert.equal(validateInquiry({ ...valid, subject: "hello\r\nBcc: test" }).ok, false);
  assert.equal(validateInquiry({ ...valid, inquiryType: "Unknown" }).ok, false);
  assert.equal(validateInquiry({ ...valid, message: "bad\u0000data" }).ok, false);
});
test("valid values are trimmed and multiline messages preserved", () => {
  const result = validateInquiry({ ...valid, name: "  Test Person  ", message: "Line one\nLine two" });
  assert.equal(result.ok, true);
  assert.equal(result.data.name, "Test Person");
  assert.equal(result.data.message, "Line one\nLine two");
});
test("rejects malformed JSON, arrays, unexpected keys, and filled honeypot", async () => {
  for (const body of ["{bad", "null", "[]", { ...valid, website: "spam" }, { ...valid, to: "attacker@example.org" }, { ...valid, website: null }]) assert.equal((await handleContact(request(body), env, noNetwork)).status, 400);
});
test("invalid fields return accessible field error keys", async () => {
  const response = await handleContact(request({ ...valid, email: "bad" }), env, noNetwork);
  assert.equal(response.status, 422);
  assert.ok((await response.json()).errors.email);
});
test("origin and content type guards", async () => {
  assert.equal((await handleContact(request(valid, { Origin: "https://evil.example.org" }), env, noNetwork)).status, 403);
  assert.equal((await handleContact(request(valid, { Origin: "null" }), env, noNetwork)).status, 403);
  assert.equal((await handleContact(request(valid, { "Sec-Fetch-Site": "cross-site" }), env, noNetwork)).status, 403);
  assert.equal((await handleContact(request(valid, { "Content-Type": "text/plain" }), env, noNetwork)).status, 415);
  const missingOrigin = request(); missingOrigin.headers.delete("origin");
  assert.equal((await handleContact(missingOrigin, env, noNetwork)).status, 403);
});
test("size cap covers declared and chunked bodies", async () => {
  assert.equal((await handleContact(request(valid, { "Content-Length": "25000" }), env, noNetwork)).status, 413);
  const chunked = new Request("https://portfolio.example.org/api/contact", {
    method: "POST", headers: { Origin: env.CONTACT_ALLOWED_ORIGIN, "Content-Type": "application/json" }, duplex: "half",
    body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(12000)); controller.enqueue(new Uint8Array(14000)); controller.close(); } }),
  });
  assert.equal((await handleContact(chunked, env, noNetwork)).status, 413);
});
test("missing configuration fails safely without network or success", async () => {
  for (const field of Object.keys(env).filter((field) => field !== "NODE_ENV")) {
    const response = await handleContact(request(), { ...env, [field]: "" }, noNetwork);
    assert.equal(response.status, 503, field);
    assert.match((await response.json()).message, /has not been sent/);
  }
});
test("unsafe configuration is rejected", async () => {
  for (const override of [{ CONTACT_FROM_EMAIL: "a@example.org\r\nBcc: b@example.org" }, { CONTACT_TO_EMAIL: "a@example.org,b@example.org" }, { CONTACT_ALLOWED_ORIGIN: "http://portfolio.example.org" }, { UPSTASH_REDIS_REST_URL: "https://evil.example.org" }]) {
    const configured = { ...env, ...override };
    assert.equal((await handleContact(request(valid, { Origin: configured.CONTACT_ALLOWED_ORIGIN }), configured, noNetwork)).status, 503);
  }
});
test("shared quota blocks before email and sets Retry-After", async () => {
  const mock = services({ count: 11 });
  const response = await handleContact(request(), env, mock.send);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(mock.calls.length, 1);
});
test("limiter failure and malformed responses fail closed", async () => {
  for (const settings of [{ redisStatus: 500 }, { redisBody: {} }, { redisBody: { result: "1" } }, { redisBody: { result: 0 } }]) {
    const mock = services(settings);
    assert.equal((await handleContact(request(), env, mock.send)).status, 503);
    assert.equal(mock.calls.length, 1);
  }
});
test("email failures and unconfirmed acceptance never return success", async () => {
  for (const settings of [{ emailStatus: 401 }, { emailStatus: 429 }, { emailStatus: 500 }, { emailBody: {} }, { emailBody: { id: "" } }, { fail: true }]) {
    const mock = services(settings);
    assert.equal((await handleContact(request(), env, mock.send)).status, 502);
  }
});
test("provider acceptance is accurately reported with a fixed destination and text-only template", async () => {
  const mock = services();
  const response = await handleContact(request({ ...valid, message: "<script>test</script>\nText only" }), env, mock.send);
  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /Inbox delivery is not yet confirmed/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(mock.calls.length, 2);
  for (const call of mock.calls) assert.equal(call.init.redirect, "error", "Never forward provider requests to redirect destinations");
  const quota = JSON.parse(mock.calls[0].init.body);
  assert.equal(quota[0], "EVAL");
  assert.equal(quota.length, 4);
  const email = JSON.parse(mock.calls[1].init.body);
  assert.deepEqual(email.to, [env.CONTACT_TO_EMAIL]);
  assert.equal(email.from, env.CONTACT_FROM_EMAIL);
  assert.equal(email.reply_to, valid.email);
  assert.equal(email.html, undefined);
  assert.ok(email.text.includes("<script>test</script>\nText only"));
});
