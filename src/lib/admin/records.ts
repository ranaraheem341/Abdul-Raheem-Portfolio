import "server-only";
import { requireAdmin } from "./auth";

export async function getRecordEditors() {
  const supabase = await requireAdmin();
  try {
    // Explicit pagination avoids silently omitting records at the API row limit.
    const records = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("record_drafts")
        .select("kind,id,payload,revision,published_revision,archived").order("kind").order("id").range(offset, offset + 499);
      if (error || !data) return null;
      records.push(...data);
      if (data.length < 500) return records;
    }
  } catch { return null; }
}
