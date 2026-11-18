import "server-only";
import { requireAdmin } from "./auth";

export async function getAdminProfileCount() {
  const supabase = await requireAdmin();
  const { count, error } = await supabase.from("profile").select("id", { count: "exact", head: true });
  if (error) throw new Error("Admin database unavailable.");
  return count ?? 0;
}

export async function listAdminMedia() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.storage.from("portfolio-media").list("", { limit: 20 });
  if (error) throw new Error("Admin storage unavailable.");
  return data.map(({ name }) => ({ name }));
}
