import { requireAdmin } from "@/lib/admin/auth";
import { validId } from "@/lib/admin/records-validation";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await requireAdmin();
  const { id } = await context.params;
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "X-Robots-Tag": "noindex, nofollow", "Vary": "Cookie" };
  const missing = () => new Response("File unavailable", { status: 404, headers });
  if (!validId(id)) return missing();
  try {
    const { data: item, error } = await supabase.from("media").select("object_path,mime_type,purpose,deleting").eq("id",id).single();
    if (error || !item || item.deleting || !["photo","cv","screenshot"].includes(item.purpose) || !["image/png","image/jpeg","image/webp","application/pdf"].includes(item.mime_type)) return missing();
    const { data, error: downloadError } = await supabase.storage.from("portfolio-media").download(item.object_path);
    if (downloadError || !data) return missing();
    // PDFs are downloads, never embedded executable previews. Images stay same-origin.
    const pdf = item.mime_type === "application/pdf";
    return new Response(data, { headers: { ...headers, "Content-Type": item.mime_type, "Content-Disposition": pdf ? 'attachment; filename="cv.pdf"' : "inline" } });
  } catch { return missing(); }
}
