"use server";

import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function login(form: FormData) {
  const config = getSupabaseConfig();
  if (!config) redirect("/admin/login?status=unavailable");
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !password.length || password.length > 1024) redirect("/admin/login?status=denied");
  const supabase = await createSupabaseServerClient();
  let authorized = false;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user?.id === config.adminId) {
      // Revalidate identity against Auth, then check the independently locked DB allowlist.
      const verified = await supabase.auth.getUser();
      if (!verified.error && verified.data.user?.id === config.adminId) {
        const allowed = await supabase.rpc("is_portfolio_admin");
        authorized = !allowed.error && allowed.data === true;
      }
    }
  } catch { /* Use the same generic failure for every rejected identity. */ }
  if (!authorized) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login?status=denied");
  }
  redirect("/admin");
}

export async function logout() {
  const supabase = await requireAdmin();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please retry.");
  redirect("/admin/login");
}
