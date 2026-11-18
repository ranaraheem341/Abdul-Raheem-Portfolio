import { createPublicClient, createAssetClient } from "@/lib/supabase/public";
import { validId } from "@/lib/admin/records-validation";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "X-Robots-Tag": "noindex, nofollow" };
  const missing = () => new Response("File unavailable", { status: 404, headers });
  const { id } = await context.params;
  if (!validId(id)) return missing();
  try {
    const client = createPublicClient();
    if (!client) return missing();
    const read = () => client.from("media").select("object_path,mime_type,purpose,published,deleting,revision,size_bytes").eq("id",id).eq("published",true).eq("deleting",false).single();
    const { data: item, error } = await read();
    if (error || !item || !item.published || item.deleting || !["photo","cv","screenshot"].includes(item.purpose) ||
      (item.purpose === "cv" ? item.mime_type !== "application/pdf" : !["image/png","image/jpeg","image/webp"].includes(item.mime_type)) ||
      !new RegExp(`^${item.purpose}/[0-9a-f-]{36}\\.(png|jpg|webp|pdf)$`).test(item.object_path)) return missing();
    const storage = createAssetClient();
    if (!storage) return missing();
    const { data, error: downloadError } = await storage.storage.from("portfolio-media").download(item.object_path);
    if (downloadError || !data || data.size !== item.size_bytes) return missing();
    // Recheck approval after download, including project archival and replacement.
    const current = await read();
    if (current.error || !current.data || current.data.revision !== item.revision) return missing();
    return new Response(data, { headers: { ...headers, "Content-Type": item.mime_type, "Content-Disposition": item.purpose === "cv" ? 'attachment; filename="cv.pdf"' : "inline" } });
  } catch { return missing(); }
}
