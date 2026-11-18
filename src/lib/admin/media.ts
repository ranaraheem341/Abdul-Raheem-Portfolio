import "server-only";
import { requireAdmin } from "./auth";
export async function getMediaEditor() {
  const supabase = await requireAdmin();
  try {
    const items = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("media").select("id,object_path,mime_type,size_bytes,alt_text,purpose,draft_project_id,published,revision,deleting").order("id").range(offset,offset+499);
      if (error || !data) return null;
      items.push(...data);
      if (data.length < 500) return items;
    }
  } catch { return null; }
}
