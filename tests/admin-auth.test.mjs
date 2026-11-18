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
const { getSupabaseConfig } = await import(configUrl);
const adminId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const envNames = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ADMIN_USER_ID"];
const original = envNames.map((name) => process.env[name]);
function configure() {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  process.env.SUPABASE_ADMIN_USER_ID = adminId;
}
const redirectUrl = moduleUrl('export function redirect(url) { throw Object.assign(new Error(url), { redirect: url }); }');
const serverUrl = moduleUrl('export async function createSupabaseServerClient() { return globalThis.__adminTest.client; }');
const authUrl = moduleUrl((await source("src/lib/admin/auth.ts"))
  .replace('"next/navigation"', JSON.stringify(redirectUrl))
  .replace('"../supabase/config"', JSON.stringify(configUrl))
  .replace('"../supabase/server"', JSON.stringify(serverUrl)));
const { requireAdmin } = await import(authUrl);
const { getAdminProfileCount, listAdminMedia } = await import(moduleUrl((await source("src/lib/admin/data.ts"))
  .replace('"./auth"', JSON.stringify(authUrl))));
const { login, logout } = await import(moduleUrl((await source("src/app/admin/login/actions.ts"))
  .replace('"next/navigation"', JSON.stringify(redirectUrl))
  .replace('"@/lib/supabase/config"', JSON.stringify(configUrl))
  .replace('"@/lib/supabase/server"', JSON.stringify(serverUrl))
  .replace('"@/lib/admin/auth"', JSON.stringify(authUrl))));
function mock({ id = adminId, verifiedId = id, userError = null, allowed = true, rpcError = null, throws = false } = {}) {
  configure();
  const calls = { user: 0, rpc: 0, query: 0, storage: 0, signin: 0, signout: 0 };
  const client = {
    auth: {
      getUser: async () => { calls.user++; if (throws) throw Error("provider down"); return { data: { user: verifiedId ? { id: verifiedId } : null }, error: userError }; },
      getSession: () => { throw Error("Unverified sessions must never authorize"); },
      signInWithPassword: async () => { calls.signin++; return { data: { user: id ? { id } : null }, error: userError }; },
      signOut: async () => { calls.signout++; return { error: null }; },
    },
    rpc: async () => { calls.rpc++; return { data: allowed, error: rpcError }; },
    from: () => { calls.query++; return { select: async () => ({ count: 1, error: null }) }; },
    storage: { from: () => { calls.storage++; return { list: async () => ({ data: [{ name: "test.png", secret: "not returned" }], error: null }) }; } },
  };
  globalThis.__adminTest = { client };
  return { client, calls };
}
const denied = (fn) => assert.rejects(fn, (error) => error.redirect === "/admin/login?status=denied");
test.after(() => {
  envNames.forEach((name, i) => { if (original[i] === undefined) delete process.env[name]; else process.env[name] = original[i]; });
  delete globalThis.__adminTest;
});

test("configuration fails closed; refuses privileged keys and malformed IDs/origins", () => {
  configure();
  assert.equal(getSupabaseConfig().adminId, adminId);
  for (const name of envNames) { configure(); delete process.env[name]; assert.equal(getSupabaseConfig(), null); }
  for (const key of ["sb_secret_test_only", "legacy-service-role-jwt", ""]) { configure(); process.env.SUPABASE_PUBLISHABLE_KEY = key; assert.equal(getSupabaseConfig(), null); }
  for (const url of ["http://test.supabase.co", "https://test.supabase.co/path", "https://user:pass@test.supabase.co", "invalid"]) { configure(); process.env.SUPABASE_URL = url; assert.equal(getSupabaseConfig(), null); }
  configure(); process.env.SUPABASE_ADMIN_USER_ID = "admin"; assert.equal(getSupabaseConfig(), null);
});
test("missing configuration denies before any Auth or data call", async () => {
  const { calls } = mock(); delete process.env.SUPABASE_ADMIN_USER_ID;
  await assert.rejects(requireAdmin, (error) => error.redirect.endsWith("status=unavailable"));
  assert.equal(calls.user, 0); assert.equal(calls.query, 0);
});
test("anonymous, different UUID, revoked/invalid identity and provider failures deny", async () => {
  for (const opts of [{ id: null }, { id: otherId }, { userError: Error("invalid") }, { throws: true }]) {
    const { calls } = mock(opts); await denied(requireAdmin); assert.equal(calls.rpc, 0);
  }
});
test("DB allowlist mismatch, missing RPC and unexpected RPC result deny", async () => {
  for (const opts of [{ allowed: false }, { rpcError: Error("missing migration") }, { allowed: "true" }, { allowed: null }]) {
    mock(opts); await denied(requireAdmin);
  }
});
test("only server-verified UUID plus DB authorization returns a client", async () => {
  const { client, calls } = mock(); assert.equal(await requireAdmin(), client);
  assert.equal(calls.user, 1); assert.equal(calls.rpc, 1);
});
test("each data/storage operation independently checks authorization before access", async () => {
  for (const operation of [getAdminProfileCount, listAdminMedia]) {
    const { calls } = mock({ id: otherId }); await denied(operation);
    assert.equal(calls.query, 0); assert.equal(calls.storage, 0);
  }
  const { calls } = mock(); assert.equal(await getAdminProfileCount(), 1);
  assert.deepEqual(await listAdminMedia(), [{ name: "test.png" }]);
  assert.equal(calls.user, 2); assert.equal(calls.rpc, 2);
});
function credentials() { const form = new FormData(); form.set("email", "admin@example.test"); form.set("password", "test-only-password"); return form; }
test("login validates inputs before contacting Auth", async () => {
  const { calls } = mock(); await denied(() => login(new FormData())); assert.equal(calls.signin, 0);
});
test("login denies other users and mismatched allowlist and clears local session", async () => {
  for (const opts of [{ id: otherId }, { verifiedId: otherId }, { allowed: false }, { userError: Error("bad password") }, { throws: true }]) {
    const { calls } = mock(opts); await denied(() => login(credentials())); assert.equal(calls.signout, 1);
  }
});
test("successful login revalidates user and has a fixed redirect", async () => {
  const { calls } = mock(); const form = credentials(); form.set("next", "https://attacker.example");
  await assert.rejects(() => login(form), (error) => error.redirect === "/admin");
  assert.equal(calls.user, 1); assert.equal(calls.rpc, 1);
});
test("direct logout action is authorized independently", async () => {
  let state = mock({ id: otherId }); await denied(logout); assert.equal(state.calls.signout, 0);
  state = mock(); await assert.rejects(logout, (error) => error.redirect === "/admin/login"); assert.equal(state.calls.signout, 1);
});
test("migration includes eight RLS tables, private singleton and private bucket policies", async () => {
  const sql = await source("supabase/migrations/202611170001_admin_foundation.sql");
  for (const table of ["profile", "links", "experience", "skills", "education", "certifications", "projects", "media"]) assert.match(sql, new RegExp(`create table public\\.${table} \\(`));
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /with check \(\(select public.is_portfolio_admin\(\)\)\)/);
  assert.match(sql, /singleton boolean primary key default true check \(singleton\)/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /'portfolio-media', 'portfolio-media', false/);
  assert.match(sql, /with check \(bucket_id = 'portfolio-media' and/);
  assert.match(sql, /as restrictive for all to authenticated/);
  assert.match(sql, /as restrictive for all to anon/);
  assert.doesNotMatch(sql, /insert into (auth.users|private.portfolio_admin)/);
});

const nextServerUrl = moduleUrl(`
  export const NextResponse = { next({ request }) {
    const values = new Map();
    return { request, headers: new Headers(), cookies: {
      set(name, value, options) { values.set(name, { name, value, ...options }); },
      getAll() { return [...values.values()]; }
    } };
  } };
`);
const ssrUrl = moduleUrl(`
  export function createServerClient(url, key, options) {
    globalThis.__adminTest.options = options;
    return { auth: { async getClaims() {
      globalThis.__adminTest.refreshCalls++;
      options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'refreshed-test-only', options: options.cookieOptions }], {
        'Cache-Control': 'must-be-overridden', 'X-Test-Refresh': 'preserved'
      });
      return { data: null, error: null };
    } } };
  }
`);
const { proxy } = await import(moduleUrl((await source("src/proxy.ts"))
  .replace('"@supabase/ssr"', JSON.stringify(ssrUrl))
  .replace('"next/server"', JSON.stringify(nextServerUrl))
  .replace('"@/lib/supabase/config"', JSON.stringify(configUrl))));
function proxyRequest() {
  const values = new Map();
  return { cookies: { getAll: () => [...values].map(([name, value]) => ({ name, value })), set: (name, value) => values.set(name, value) } };
}
test("Proxy forwards refreshed request/response cookies and preserves SDK headers with no-store", async () => {
  mock(); globalThis.__adminTest.refreshCalls = 0;
  const request = proxyRequest(); const response = await proxy(request);
  assert.equal(globalThis.__adminTest.refreshCalls, 1);
  assert.equal(request.cookies.getAll()[0].value, "refreshed-test-only");
  assert.equal(response.cookies.getAll()[0].httpOnly, true);
  assert.equal(response.cookies.getAll()[0].sameSite, "lax");
  assert.equal(response.headers.get("X-Test-Refresh"), "preserved");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
});
test("Proxy does not construct an SDK client without complete configuration", async () => {
  mock(); delete process.env.SUPABASE_ADMIN_USER_ID;
  const response = await proxy(proxyRequest());
  assert.equal(globalThis.__adminTest.options, undefined);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});
