import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function moduleUrl(code) {
  const { outputText } = ts.transpileModule(code.replaceAll('import "server-only";', ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const configUrl = moduleUrl(await source("src/lib/supabase/config.ts"));
const redirectUrl = moduleUrl('export function redirect(url) { throw Object.assign(Error(url), { redirect: url }); }');
const serverUrl = moduleUrl('export async function createSupabaseServerClient() { return globalThis.__recordsTest.client; }');
const authUrl = moduleUrl((await source("src/lib/admin/auth.ts")).replace('"next/navigation"', JSON.stringify(redirectUrl)).replace('"../supabase/config"', JSON.stringify(configUrl)).replace('"../supabase/server"', JSON.stringify(serverUrl)));
const validationUrl = moduleUrl(await source("src/lib/admin/records-validation.ts"));
const cacheUrl = moduleUrl('export function revalidatePath(path, type) { (globalThis.__recordRefresh ??= []).push([path, type]); }');
const { emptyRecord, recordSections, validateRecord } = await import(validationUrl);
const { writeRecord } = await import(moduleUrl((await source("src/app/admin/record-actions.ts")).replace('"@/lib/admin/auth"', JSON.stringify(authUrl)).replace('"@/lib/admin/records-validation"', JSON.stringify(validationUrl)).replace('"next/cache"', JSON.stringify(cacheUrl))));
const { getRecordEditors } = await import(moduleUrl((await source("src/lib/admin/records.ts")).replace('"./auth"', JSON.stringify(authUrl))));
const adminId = "00000000-0000-4000-8000-000000000001";
const recordId = "00000000-0000-4000-8000-000000000002";
const names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ADMIN_USER_ID"];
const original = names.map(name => process.env[name]);
const initial = { record: emptyRecord("skills", recordId), errors: {}, message: "", ok: false };
const samples = {
  projects: { title: "Test project", description: "Synthetic project description", technologies: "TypeScript\nPostgreSQL", project_url: "https://example.test", source_url: "" },
  experience: { role: "Test role", company: "Test company", start_date: "2020-02-29", end_date: "", highlights: "Test highlight\nSecond test highlight" },
  skills: { name: "Test skill", category: "Test category" },
  education: { institution: "Test institution", qualification: "Test qualification", start_date: "", end_date: "", description: "" },
  certifications: { name: "Test certificate", issuer: "Test issuer", issued_on: "", expires_on: "", credential_url: "" },
};
function form(kind = "skills", intent = "save", revision = "0") {
  const f = new FormData();
  for (const [key, value] of Object.entries({ ...samples[kind], kind, id: recordId, intent, revision, sort_order: "2" })) f.set(key, value);
  return f;
}
function mock({ id = adminId, allowed = true, authError = null, error = null, throws = false, badData = false, readError = false, pages = [[]] } = {}) {
  process.env.SUPABASE_URL = "https://test.supabase.co"; process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only"; process.env.SUPABASE_ADMIN_USER_ID = adminId;
  const calls = { auth: 0, writes: [], reads: [], page: 0 };
  globalThis.__recordsTest = { client: {
    auth: { getUser: async () => { calls.auth++; return { data: { user: id ? { id } : null }, error: authError }; } },
    rpc: async (name, args) => {
      if (name === "is_portfolio_admin") return { data: allowed, error: null };
      calls.writes.push({ name, args }); if (throws) throw Error("private provider detail");
      return { error, data: badData ? [] : [{ kind: args.record_kind, id: args.record_id, payload: args.content, revision: args.expected_revision + 1, published_revision: args.operation === "publish" ? args.expected_revision + 1 : null, archived: args.operation === "archive" }] };
    },
    from: name => { calls.reads.push(name); const chain = { order: () => chain, range: async (start, end) => { assert.equal(end - start, 499); return { error: readError ? Error("private schema error") : null, data: pages[calls.page++] ?? [] }; } }; return { select: () => chain }; },
  } };
  return calls;
}
test.after(() => { names.forEach((name, i) => { if (original[i] === undefined) delete process.env[name]; else process.env[name] = original[i]; }); delete globalThis.__recordsTest; });

test("every direct mutation and read reauthorizes denied identities before touching content", async () => {
  for (const options of [{ id: null }, { id: recordId }, { authError: Error("revoked") }, { allowed: false }]) {
    for (const operation of ["save", "publish", "archive", "delete", "read"]) {
      const calls = mock(options);
      await assert.rejects(() => operation === "read" ? getRecordEditors() : writeRecord(initial, form("skills", operation, "1")), e => e.redirect === "/admin/login?status=denied");
      assert.equal(calls.writes.length, 0); assert.equal(calls.reads.length, 0);
    }
  }
});

test("public cache invalidates on record publish/archive/delete but not draft or denied writes", async () => {
  for (const intent of ["save", "publish", "archive", "delete"]) {
    mock(); globalThis.__recordRefresh = [];
    const input = form("skills", intent, "1"); input.set("confirm_delete", "yes");
    assert.equal((await writeRecord(initial, input)).ok, true);
    assert.deepEqual(globalThis.__recordRefresh, intent === "save" ? [] : [["/", "layout"]]);
  }
  mock({ error: { code: "40001" } }); globalThis.__recordRefresh = [];
  assert.equal((await writeRecord(initial, form("skills", "publish"))).ok, false);
  assert.deepEqual(globalThis.__recordRefresh, []);
});
test("missing Supabase configuration denies before provider calls", async () => {
  for (const operation of [() => writeRecord(initial, form()), getRecordEditors]) {
    const calls = mock(); delete process.env.SUPABASE_URL;
    await assert.rejects(operation, e => e.redirect === "/admin/login?status=unavailable"); assert.equal(calls.auth, 0);
  }
});
test("all record kinds including projects save and publish only validated fields, order and submitted revision", async () => {
  for (const kind of Object.keys(recordSections)) for (const intent of ["save", "publish"]) {
    const calls = mock(); const input = form(kind, intent); input.set("admin_id", "forged"); input.set("archived", "true");
    const result = await writeRecord({ ...initial, record: { ...initial.record, revision: 999 } }, input);
    assert.equal(result.ok, true); assert.equal(result.record.revision, 1); assert.equal(calls.auth, 1);
    assert.deepEqual(calls.writes[0], { name: "write_record_editor", args: { record_kind: kind, record_id: recordId, expected_revision: 0, operation: intent, content: validateRecord(kind, input).payload } });
    assert.equal(calls.writes[0].args.content.sort_order, 2); assert.equal(result.record.published_revision, intent === "publish" ? 1 : null);
  }
});
test("required fields, duplicate/file/missing fields, lengths and controls reject writes", async () => {
  for (const kind of Object.keys(recordSections)) {
    for (const [key, config] of Object.entries(recordSections[kind].fields)) {
      const mutations = [f => f.delete(key), f => f.append(key, "duplicate"), f => f.set(key, new Blob(["x"]), "test.txt"), f => f.set(key, "x".repeat(config.max + 1)), f => f.set(key, "bad\u0000value")];
      if (config.required) mutations.push(f => f.set(key, " "));
      for (const mutate of mutations) {
        const calls = mock(); const input = form(kind); mutate(input); const result = await writeRecord(initial, input);
        assert.equal(result.ok, false); assert.ok(result.errors[key], `${kind}.${key}`); assert.equal(calls.writes.length, 0);
      }
    }
  }
});
test("dates, highlights, credential destinations and ordering have strict bounds", async () => {
  for (const [kind, key, value] of [
    ["experience", "start_date", "2021-02-29"], ["experience", "start_date", "0000-01-01"], ["experience", "end_date", "2019-01-01"],
    ["experience", "highlights", Array(21).fill("test").join("\n")], ["experience", "highlights", "x".repeat(501)],
    ["certifications", "credential_url", "javascript:alert(1)"], ["certifications", "credential_url", "http://example.test"],
    ["certifications", "credential_url", "https://u:p@example.test"], ["certifications", "credential_url", "https://example.test:444/"],
    ["skills", "sort_order", "-1"], ["skills", "sort_order", "1.1"], ["skills", "sort_order", "1000000"],
  ]) {
    const calls = mock(); const input = form(kind); input.set(key, value);
    assert.ok((await writeRecord(initial, input)).errors[key]); assert.equal(calls.writes.length, 0);
  }
  for (const kind of ["education", "certifications"]) {
    const input = form(kind); const start = kind === "education" ? "start_date" : "issued_on"; const end = kind === "education" ? "end_date" : "expires_on";
    input.set(start, "2024-03-01"); input.set(end, "2024-02-29"); assert.ok(validateRecord(kind, input).errors[end]);
  }
});
test("invalid identifiers, kinds, revisions, intents and duplicate metadata cannot select writes", async () => {
  for (const [key, value] of [["kind", "projects"], ["kind", "__proto__"], ["id", "invalid"], ["revision", "-1"], ["revision", "1.5"], ["intent", "drop"]]) {
    const calls = mock(); const input = form(); input.set(key, value); assert.equal((await writeRecord(initial, input)).ok, false); assert.equal(calls.writes.length, 0);
  }
  for (const key of ["kind", "id", "revision", "intent"]) {
    const calls = mock(); const input = form(); input.append(key, input.get(key)); assert.equal((await writeRecord(initial, input)).ok, false); assert.equal(calls.writes.length, 0);
  }
});
test("archive and confirmed delete send only identifiers and revision, never unsaved form content", async () => {
  for (const kind of Object.keys(recordSections)) for (const intent of ["archive", "delete"]) {
    const calls = mock(); const input = form(kind, intent, "4"); input.set("confirm_delete", "yes"); input.set(Object.keys(samples[kind])[0], "");
    const result = await writeRecord(initial, input); assert.equal(result.ok, true); assert.equal(result.deleted, intent === "delete");
    assert.deepEqual(calls.writes[0].args.content, {}); assert.equal(calls.writes[0].args.expected_revision, 4);
  }
  for (const intent of ["archive", "delete"]) {
    const calls = mock(); assert.equal((await writeRecord(initial, form("skills", intent))).ok, false); assert.equal(calls.writes.length, 0);
  }
  const calls = mock(); assert.equal((await writeRecord(initial, form("skills", "delete", "1"))).ok, false); assert.equal(calls.writes.length, 0);
});
test("conflicts, denied writes and uncertain responses never report success or expose diagnostics", async () => {
  for (const opts of [{ error: { code: "40001" } }, { error: { code: "42501", message: "private diagnostic" } }, { throws: true }, { badData: true }]) {
    mock(opts); const result = await writeRecord(initial, form()); assert.equal(result.ok, false); assert.doesNotMatch(result.message, /private diagnostic|private provider/); assert.match(result.message, opts.error?.code === "40001" ? /newer version/ : /could not be confirmed/);
  }
});
test("reads paginate beyond row limits and schema failures disable editing", async () => {
  const rows = Array.from({ length: 500 }, () => initial.record);
  const calls = mock({ pages: [rows, [initial.record]] }); assert.equal((await getRecordEditors()).length, 501); assert.equal(calls.auth, 1); assert.equal(calls.page, 2);
  mock({ readError: true }); assert.equal(await getRecordEditors(), null);
});
test("migration preserves history and RLS, whitelists tables and serializes atomic lifecycle changes", async () => {
  const sql = await source("supabase/migrations/202611170003_record_editors.sql") + await source("supabase/migrations/202611170004_projects_media.sql");
  assert.match(sql, /force row level security/); assert.match(sql, /security invoker set search_path = ''/); assert.match(sql, /pg_advisory_xact_lock/); assert.match(sql, /for update/); assert.match(sql, /errcode='40001'/);
  assert.match(sql, /operation='publish'[\s\S]*jsonb_populate_record/); assert.match(sql, /revoke all on function .* from public, anon/);
  for (const kind of Object.keys(recordSections)) assert.match(sql, new RegExp(`from public.${kind} `));
  assert.doesNotMatch(sql, /security definer|grant .* to anon|truncate |drop table/i);
});
