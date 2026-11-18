import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "../supabase/config";
import { createSupabaseServerClient } from "../supabase/server";

// Never trust getSession(), user metadata, a layout, or the Proxy as authorization.
export async function requireAdmin() {
  const config = getSupabaseConfig();
  if (!config) redirect("/admin/login?status=unavailable");
  const supabase = await createSupabaseServerClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.id === config.adminId) {
      const allowed = await supabase.rpc("is_portfolio_admin");
      if (!allowed.error && allowed.data === true) return supabase;
    }
  } catch {
    // Provider/network failures deny access without exposing diagnostics.
  }
  redirect("/admin/login?status=denied");
}
