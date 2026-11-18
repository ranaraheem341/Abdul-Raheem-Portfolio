import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function moduleUrl(code) {
  const { outputText } = ts.transpileModule(code.replaceAll('import "server-only";', ""), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const configUrl = moduleUrl(await source("src/lib/supabase/config.ts"));
const redirectUrl = moduleUrl('export function redirect(url) { throw Object.assign(Error(url), { redirect: url }); }');
const serverUrl = moduleUrl('export async function createSupabaseServerClient() { return globalThis.__profileTest.client; }');
const authUrl = moduleUrl((await source("src/lib/admin/auth.ts"))
  .replace('"next/navigation"', JSON.stringify(redirectUrl))
  .replace('"../supabase/config"', JSON.stringify(configUrl))
  .replace('"../supabase/server"', JSON.stringify(serverUrl)));
const validationUrl = moduleUrl(await source("src/lib/admin/profile-validation.ts"));
const cacheUrl = moduleUrl('export function revalidatePath(path, type) { (globalThis.__profileRefresh ??= []).push([path, type]); }');
const { emptyProfile, validateProfile } = await import(validationUrl);
const { saveProfile } = await import(moduleUrl((await source("src/app/admin/actions.ts"))
  .replace('"@/lib/admin/auth"', JSON.stringify(authUrl))
  .replace('"@/lib/admin/profile-validation"', JSON.stringify(validationUrl))
  .replace('"next/cache"', JSON.stringify(cacheUrl))));
const { getProfileEditor } = await import(moduleUrl((await source("src/lib/admin/profile.ts"))
  .replace('"./auth"', JSON.stringify(authUrl))
  .replace('"./profile-validation"', JSON.stringify(validationUrl))));
const adminId = "00000000-0000-4000-8000-000000000001";
const names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ADMIN_USER_ID"];
const original = names.map((name) => process.env[name]);
const initial = { values: emptyProfile, revision: 0, publishedRevision: null, errors: {}, message: "", ok: false };
function form(intent = "save") {
  const result = new FormData();
  for (const [key, value] of Object.entries({ ...emptyProfile, full_name: "  Test Owner  " })) result.set(key, value);
  result.set("revision", "0"); result.set("intent", intent); return result;
}
function mock({ id = adminId, allowed = true, authError = null, error = null, throws = false, data = [{ revision: 1, published_revision: null }], readError = false, draftPayload = { ...emptyProfile, full_name: "Stored" } } = {}) {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  process.env.SUPABASE_ADMIN_USER_ID = adminId;
  const calls = { auth: 0, writes: [], reads: 0 };
  globalThis.__profileTest = { client: {
    auth: { getUser: async () => { calls.auth++; return { data: { user: id ? { id } : null }, error: authError }; } },
    rpc: async (name, args) => {
      if (name === "is_portfolio_admin") return { data: allowed, error: null };
      calls.writes.push({ name, args }); if (throws) throw Error("private provider detail");
      return { data, error };
    },
    from: () => { calls.reads++; return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: readError ? Error("missing migration") : null, data: readError ? null : { payload: draftPayload, revision: 4, published_revision: 2 } }) }) }) }; },
  } };
  return calls;
}
test.after(() => {
  names.forEach((name, i) => { if (original[i] === undefined) delete process.env[name]; else process.env[name] = original[i]; });
  delete globalThis.__profileTest;
});
test("direct save/publish and editor reads reject absent, different, revoked and unallowlisted users", async () => {
  for (const opts of [{ id: null }, { id: "00000000-0000-4000-8000-000000000002" }, { authError: Error("revoked") }, { allowed: false }]) {
    for (const operation of [() => saveProfile(initial, form("save")), () => saveProfile(initial, form("publish")), getProfileEditor]) {
      const calls = mock(opts);
      await assert.rejects(operation, (error) => error.redirect === "/admin/login?status=denied");
      assert.equal(calls.writes.length, 0); assert.equal(calls.reads, 0);
    }
  }
});
test("missing configuration denies before provider calls", async () => {
  const calls = mock(); delete process.env.SUPABASE_URL;
  await assert.rejects(() => saveProfile(initial, form()), (error) => error.redirect.endsWith("unavailable"));
  assert.equal(calls.auth, 0); assert.equal(calls.writes.length, 0);
});
test("validates text shape, required name, limits, duplicate and file inputs", async () => {
  for (const mutate of [
    (f) => f.set("full_name", "  "), (f) => f.delete("biography"),
    (f) => f.set("headline", "x".repeat(241)), (f) => f.set("biography", "x".repeat(10001)),
    (f) => f.set("professional_summary", "x".repeat(3001)), (f) => f.set("headline", "a\u0000b"),
    (f) => f.append("full_name", "duplicate"), (f) => f.set("biography", new Blob(["not text"]), "bio.txt"),
  ]) {
    const calls = mock(); const input = form(); mutate(input);
    const result = await saveProfile(initial, input);
    assert.equal(result.ok, false); assert.ok(Object.keys(result.errors).length); assert.equal(calls.writes.length, 0);
  }
});
test("rejects unsafe, off-domain social links and email header/query injection", async () => {
  for (const [key, value] of [
    ["github", "javascript:alert(1)"], ["linkedin", "http://linkedin.com/in/test"],
    ["fiverr", "https://fiverr.com.evil.test/user"], ["github", "https://u:p@github.com/test"],
    ["github", "https://github.com:444/test"], ["github", "https://evil.test/github.com"],
    ["public_email", "test@example.test?subject=x"], ["public_email", "test@example.test\r\nBcc:other@example.test"],
  ]) {
    const calls = mock(); const input = form(); input.set(key, value);
    const result = await saveProfile(initial, input);
    assert.ok(result.errors[key]); assert.equal(calls.writes.length, 0);
  }
  const input = form(); input.set("github", "https://github.com/test"); input.set("public_email", "hello+public@example.test");
  assert.deepEqual(validateProfile(input).errors, {});
});
test("rejects invalid, duplicate and missing revision/intent rather than accepting forged prior state", async () => {
  for (const mutate of [(f) => f.set("revision", "-1"), (f) => f.set("revision", "1.1"), (f) => f.delete("intent"), (f) => f.set("intent", "delete"), (f) => f.append("revision", "0"), (f) => f.append("intent", "publish")]) {
    const calls = mock(); const input = form(); mutate(input);
    assert.equal((await saveProfile({ ...initial, revision: 999, ok: true }, input)).ok, false);
    assert.equal(calls.writes.length, 0);
  }
});
test("save and publish send only whitelisted values and use returned revision", async () => {
  for (const intent of ["save", "publish"]) {
    const calls = mock({ data: [{ revision: 1, published_revision: intent === "publish" ? 1 : null }] });
    globalThis.__profileRefresh = [];
    const input = form(intent); input.set("admin_id", "attacker"); input.set("location", "overwrite attempt");
    const result = await saveProfile({ ...initial, revision: 999 }, input);
    assert.equal(result.ok, true); assert.equal(result.revision, 1); assert.equal(calls.auth, 1);
    assert.equal(calls.writes[0].name, "write_profile_editor");
    assert.deepEqual(calls.writes[0].args, { content: { ...emptyProfile, full_name: "Test Owner" }, expected_revision: 0, publish_now: intent === "publish" });
    assert.match(result.message, intent === "publish" ? /Published to the public portfolio/ : /Draft saved/);
    assert.deepEqual(globalThis.__profileRefresh, intent === "publish" ? [["/", "layout"]] : []);
  }
});
test("conflicts, RLS/provider errors, empty responses and network failures never report success", async () => {
  for (const opts of [{ error: { code: "40001" } }, { error: { code: "42501", message: "private diagnostic" } }, { data: [] }, { throws: true }]) {
    mock(opts); const result = await saveProfile(initial, form("publish"));
    assert.equal(result.ok, false); assert.equal(result.revision, 0); assert.equal(result.values.full_name, "Test Owner");
    assert.doesNotMatch(result.message, /private diagnostic|private provider detail/);
    assert.match(result.message, opts.error?.code === "40001" ? /newer version/ : /could not be confirmed/);
  }
});
test("authorized reads restore draft metadata; migration/provider read failures disable editing", async () => {
  const calls = mock(); const result = await getProfileEditor();
  assert.equal(result.revision, 4); assert.equal(result.publishedRevision, 2); assert.equal(calls.auth, 1);
  mock({ readError: true }); assert.equal(await getProfileEditor(), null);
});
test("migration retains invoker RLS, locks revision and publishes inside a single function", async () => {
  const sql = await source("supabase/migrations/202611170002_profile_editor.sql");
  assert.match(sql, /force row level security/); assert.match(sql, /security invoker set search_path = ''/);
  assert.match(sql, /using \(\(select public.is_portfolio_admin\(\)\)\) with check/);
  assert.match(sql, /for update/); assert.match(sql, /errcode = '40001'/);
  assert.match(sql, /if publish_now then[\s\S]*insert into public.profile[\s\S]*insert into public.links/);
  assert.match(sql, /revoke all on function .* from public, anon/);
  assert.doesNotMatch(sql, /security definer|grant .* to anon|update set[^;]*location=/);
});

test("Upwork accepts only HTTPS official domains and rejects malformed, duplicate and oversized input", async () => {
  for (const value of [
    'http://upwork.com/freelancers/test', 'javascript:alert(1)', 'https://upwork.com.evil.test/test',
    'https://evil.test/upwork.com', 'https://user:pass@upwork.com/test', 'https://upwork.com:444/test',
    'https://support.upwork.com/test', 'https://upwork.com/test path', 'https://upwork.com/\\test',
    'https://upwork.com/' + 'x'.repeat(2048),
  ]) {
    const calls = mock(); const input = form(); input.set('upwork', value);
    assert.ok((await saveProfile(initial, input)).errors.upwork);
    assert.equal(calls.writes.length, 0);
  }
  for (const value of ['', 'https://upwork.com/freelancers/test', 'https://www.upwork.com/freelancers/~test']) {
    const input = form(); input.set('upwork', value);
    assert.deepEqual(validateProfile(input).errors, {});
  }
  const duplicate = form(); duplicate.append('upwork', 'https://upwork.com/test');
  assert.ok(validateProfile(duplicate).errors.upwork);
  const file = form(); file.set('upwork', new Blob(['url']), 'url.txt');
  assert.ok(validateProfile(file).errors.upwork);
});

test("legacy drafts default Upwork without modifying saved fields or revision metadata", async () => {
  const legacy = { ...emptyProfile, full_name: 'Legacy owner', linkedin: 'https://linkedin.com/in/old', public_email: 'old@example.test' };
  delete legacy.upwork;
  const calls = mock({ draftPayload: legacy });
  const result = await getProfileEditor();
  assert.deepEqual(result, { values: { ...legacy, upwork: '' }, revision: 4, publishedRevision: 2 });
  assert.equal('upwork' in legacy, false);
  assert.equal(calls.writes.length, 0);
  mock({ draftPayload: { ...legacy, upwork: 'https://upwork.com/freelancers/stored' } });
  assert.equal((await getProfileEditor()).values.upwork, 'https://upwork.com/freelancers/stored');
});

test("editor can initialize Upwork from published links when no stored draft exists", async () => {
  mock();
  globalThis.__profileTest.client.from = table => ({ select: () => ({
    eq: () => ({ maybeSingle: async () => ({ data: table === 'profile_draft' ? null : { full_name: 'Published owner' }, error: null }) }),
    in: (column, labels) => {
      assert.equal(column, 'label'); assert.ok(labels.includes('Upwork'));
      return Promise.resolve({ data: [{ label: 'Upwork', url: 'https://www.upwork.com/freelancers/published' }], error: null });
    },
  }) });
  const result = await getProfileEditor();
  assert.equal(result.values.upwork, 'https://www.upwork.com/freelancers/published');
  assert.equal(result.revision, 0);
});

test("Upwork draft, publish and removal use the existing revision RPC and publication-only invalidation", async () => {
  let previous = initial;
  for (const [intent, value, expectedRevision] of [
    ['save', 'https://www.upwork.com/freelancers/test', 0],
    ['publish', 'https://www.upwork.com/freelancers/test', 1],
    ['publish', '', 2],
  ]) {
    const calls = mock({ data: [{ revision: expectedRevision + 1, published_revision: intent === 'publish' ? expectedRevision + 1 : null }] });
    globalThis.__profileRefresh = [];
    const input = form(intent); input.set('upwork', value); input.set('revision', String(expectedRevision));
    previous = await saveProfile(previous, input);
    assert.equal(previous.ok, true);
    assert.equal(calls.writes[0].args.content.upwork, value);
    assert.equal(calls.writes[0].args.expected_revision, expectedRevision);
    assert.equal(calls.writes[0].args.publish_now, intent === 'publish');
    assert.deepEqual(globalThis.__profileRefresh, intent === 'publish' ? [['/', 'layout']] : []);
  }
});

test("forward Upwork migration preserves invoker security, private drafts and the publication gate", async () => {
  const sql = await source('supabase/migrations/202611180006_upwork_profile.sql');
  assert.match(sql, /create or replace function public.write_profile_editor/);
  assert.match(sql, /security invoker set search_path = ''/);
  assert.match(sql, /public.is_portfolio_admin\(\)/);
  assert.match(sql, /if not \(content \? 'upwork'\)/);
  assert.match(sql, /d.payload->>'upwork'/);
  assert.match(sql, /jsonb_object_keys\(content\)\) <> 9/);
  assert.match(sql, /\('upwork',2048\)/);
  assert.ok(sql.includes("^https://(www\\.)?upwork\\.com(/[^[:space:]\\\\]*)?$"));
  assert.match(sql, /for update/); assert.match(sql, /errcode = '40001'/);
  assert.match(sql, /if publish_now then[\s\S]*'Upwork','upwork',4/);
  assert.match(sql, /alter policy published_links on public.links to anon[\s\S]*'Upwork'[\s\S]*public.has_published_profile\(\)/);
  assert.match(sql, /revoke all on function[^;]+from public, anon/);
  assert.doesNotMatch(sql, /security definer|grant[^;]*(profile_draft|record_drafts|storage)|drop (table|function|policy)/i);
});
