import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    // Never inherit request cookies or the administrator's session.
    return createClient<Database>(parsed.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
  } catch { return null; }
}

// Restricted to the asset proxy; never used for content queries or admin writes.
export function createAssetClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!createPublicClient() || !key?.startsWith("sb_secret_")) return null;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
