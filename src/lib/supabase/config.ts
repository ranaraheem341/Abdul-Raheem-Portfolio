import "server-only";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const adminId = process.env.SUPABASE_ADMIN_USER_ID;
  if (!url || !key?.startsWith("sb_publishable_") || !adminId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return { url: parsed.origin, key, adminId: adminId.toLowerCase() };
  } catch { return null; }
}

// Auth is exclusively server-side; no browser SDK reads these cookies.
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
