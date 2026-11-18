import "server-only";
import { cache } from "react";
import { createPublicClient } from "./supabase/public";
import type { Database } from "./supabase/database.types";
import type { ContactDefinition } from "@/components/layout/navigation-config";

export type PublicRow<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
export type PublicPortfolio = {
  profile: Pick<PublicRow<"profile">, "full_name" | "headline" | "biography" | "professional_summary"> | null;
  links: ContactDefinition[];
  experience: PublicRow<"experience">[];
  skills: PublicRow<"skills">[];
  education: PublicRow<"education">[];
  certifications: PublicRow<"certifications">[];
  projects: PublicRow<"projects">[];
  media: Pick<PublicRow<"media">, "id" | "purpose" | "alt_text" | "draft_project_id" | "published" | "deleting">[];
};
const unavailable: PublicPortfolio = { profile: null, links: [], experience: [], skills: [], education: [], certifications: [], projects: [], media: [] };
export function safePublicUrl(value: string | null): `https://${string}` | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password) return url.href as `https://${string}`; } catch {}
  return undefined;
}
export function publicLinks(rows: PublicRow<"links">[]): ContactDefinition[] {
  return rows.flatMap<ContactDefinition>(({ label, url }) => {
    if (label === "Public email" && /^mailto:[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(url)) return [{ label: "Email", href: url as `mailto:${string}` }];
    const host = ({ LinkedIn: "linkedin.com", GitHub: "github.com", Fiverr: "fiverr.com", Upwork: "upwork.com" } as Record<string,string>)[label];
    const href = safePublicUrl(url);
    if (label === "Upwork" && (/[\s\\]/.test(url) || (href && new URL(href).port))) return [];
    return host && href && [host, `www.${host}`].includes(new URL(href).hostname) ? [{ label, href }] : [];
  });
}

async function readPortfolio(): Promise<PublicPortfolio | null> {
  const client = createPublicClient();
  // null means only the existing, source-controlled fallback is available.
  if (!client) return null;
  async function records<T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await read(offset);
      if (error || !data) throw new Error("Public content unavailable");
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  try {
    const [profile, links, experience, skills, education, certifications, projects, media] = await Promise.all([
      client.from("profile").select("full_name,headline,biography,professional_summary").eq("id", true).maybeSingle(),
      client.from("links").select("id,label,url,sort_order").order("sort_order").order("id"),
      records(offset => client.from("experience").select("*").eq("archived",false).order("sort_order").order("id").range(offset,offset+499)),
      records(offset => client.from("skills").select("*").eq("archived",false).order("sort_order").order("id").range(offset,offset+499)),
      records(offset => client.from("education").select("*").eq("archived",false).order("sort_order").order("id").range(offset,offset+499)),
      records(offset => client.from("certifications").select("*").eq("archived",false).order("sort_order").order("id").range(offset,offset+499)),
      records(offset => client.from("projects").select("*").eq("archived",false).order("sort_order").order("id").range(offset,offset+499)),
      records(offset => client.from("media").select("id,purpose,alt_text,draft_project_id,published,deleting").eq("published",true).eq("deleting",false).order("id").range(offset,offset+499)),
    ]);
    if (profile.error || links.error) return unavailable;
    return { profile: profile.data, links: publicLinks(links.data ?? []), experience, skills, education, certifications, projects,
      media: process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_") ? media : [] };
  } catch { return unavailable; }
}
// Request-local deduplication only; never a cross-request cache of revoked content.
export const getPublicPortfolio = cache(readPortfolio);
export function publicAsset(id: string) { return `/api/media/${id}`; }
export function publicDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
}
