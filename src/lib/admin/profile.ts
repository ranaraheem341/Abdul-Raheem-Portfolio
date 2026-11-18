import "server-only";
import { requireAdmin } from "./auth";
import { emptyProfile, type ProfileValues } from "./profile-validation";

export async function getProfileEditor() {
  const supabase = await requireAdmin();
  try {
    const draft = await supabase.from("profile_draft").select("payload,revision,published_revision").eq("id", true).maybeSingle();
    if (draft.error) return null;
    if (draft.data) return { values: { ...emptyProfile, ...draft.data.payload }, revision: draft.data.revision, publishedRevision: draft.data.published_revision };
    const [profile, links] = await Promise.all([
      supabase.from("profile").select("full_name,headline,biography,professional_summary").eq("id", true).maybeSingle(),
      supabase.from("links").select("label,url").in("label", ["LinkedIn", "Fiverr", "GitHub", "Upwork", "Public email"]),
    ]);
    if (profile.error || links.error) return null;
    const values: ProfileValues = { ...emptyProfile, ...profile.data };
    for (const link of links.data ?? []) {
      const key = ({ LinkedIn: "linkedin", Fiverr: "fiverr", GitHub: "github", Upwork: "upwork", "Public email": "public_email" } as const)[link.label as "LinkedIn" | "Fiverr" | "GitHub" | "Upwork" | "Public email"];
      if (key) values[key] = key === "public_email" ? link.url.replace(/^mailto:/, "") : link.url;
    }
    return { values, revision: 0, publishedRevision: null };
  } catch { return null; }
}
