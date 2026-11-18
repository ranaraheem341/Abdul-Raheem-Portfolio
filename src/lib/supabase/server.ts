import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Admin services are not configured.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: authCookieOptions,
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The admin Proxy refreshes them.
        }
      },
    },
  });
}
