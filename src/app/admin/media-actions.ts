"use server";
import { requireAdmin } from "@/lib/admin/auth";
import { oneText, validId } from "@/lib/admin/records-validation";
import { inspectUpload, mediaTarget, type MediaState } from "@/lib/admin/media-validation";
import { revalidatePath } from "next/cache";

export async function writeMedia(_previous: MediaState, form: FormData): Promise<MediaState> {
  const supabase = await requireAdmin();
  const failure = (message: string): MediaState => ({ ok: false, message });
  const intent = oneText(form, "intent");
  const uncertain = "Change could not be confirmed. Reload to check stored files before retrying. A private orphan upload may require owner cleanup.";
  try {
    if (intent === "upload") {
      const target = mediaTarget(form);
      const files = form.getAll("file");
      const alt = form.has("alt_text") ? oneText(form, "alt_text") : "";
      if (!target || files.length !== 1 || !(files[0] instanceof File) || alt === null || alt.length > 300 || /[\u0000-\u001f\u007f]/.test(alt)) return failure("Choose one file. Optional alternative text must be at most 300 characters and contain no control characters.");
      let upload;
      try { upload = await inspectUpload(files[0], target.purpose); }
      catch (error) { return failure(error instanceof Error ? error.message : "Invalid file."); }
      // Check the project before uploading bytes. RPC/FK independently protect registration.
      if (target.project) {
        const { data, error } = await supabase.from("record_drafts").select("id").eq("kind","projects").eq("id",target.project).single();
        if (error || !data) return failure("Save the project draft and reload before adding screenshots.");
      }
      const id = crypto.randomUUID();
      const path = `${target.purpose}/${id}.${upload.extension}`;
      const { error: uploadError } = await supabase.storage.from("portfolio-media").upload(path,upload.bytes,{ contentType: upload.mime, upsert: false, cacheControl: "0" });
      if (uploadError) return failure(uncertain);
      const { data, error } = await supabase.rpc("write_media_editor", { media_id: id, expected_revision: 0, operation: "register", metadata: { object_path: path, purpose: target.purpose, draft_project_id: target.project, mime_type: upload.mime, size_bytes: files[0].size, alt_text: alt.trim() } });
      // Do not delete the object after an uncertain response: the transaction may have committed.
      if (error || !data || data.length !== 1 || data[0].id !== id || data[0].revision !== 1) return failure(uncertain);
    } else {
      const id = oneText(form,"id");
      const revision = oneText(form,"revision");
      if (!validId(id) || revision === null || !/^[1-9]\d{0,8}$/.test(revision) || !intent || !["publish","unpublish","delete"].includes(intent)) return failure("Invalid submission. Reload before retrying.");
      let expectedRevision = Number(revision);
      if (intent === "delete") {
        if (oneText(form,"confirm_delete") !== "yes") return failure("Confirm permanent file removal first.");
        // Tombstone first, so a failed Storage removal stays private and can be retried.
        const started = await supabase.rpc("write_media_editor", { media_id: id, expected_revision: expectedRevision, operation: "begin_delete", metadata: {} });
        if (started.error || !started.data || started.data.length !== 1 || started.data[0].id !== id || started.data[0].revision !== expectedRevision+1) return failure(uncertain);
        revalidatePath("/", "layout");
        expectedRevision++;
        // Read the stored path, never a client-selected filename. Storage removal is idempotent.
        const { data: item, error } = await supabase.from("media").select("object_path,revision").eq("id",id).single();
        if (error || !item || item.revision !== expectedRevision) return failure("File changed or is unavailable. Reload before removing it.");
        const { error: removalError } = await supabase.storage.from("portfolio-media").remove([item.object_path]);
        if (removalError) return failure(uncertain);
      }
      const { data, error } = await supabase.rpc("write_media_editor", { media_id: id, expected_revision: expectedRevision, operation: intent, metadata: {} });
      if (error || !data || data.length !== 1 || data[0].id !== id || data[0].revision !== expectedRevision+1) return failure(error?.code === "40001" ? "A newer file version exists. Reload before retrying." : uncertain);
    }
    revalidatePath("/admin");
    if (intent !== "upload") revalidatePath("/", "layout");
    return { ok: true, message: intent === "upload" ? "Uploaded as a private draft. Publish when ready. Previous files are retained until removed." : intent === "delete" ? "File and metadata removed." : "Public file publication updated." };
  } catch { return failure(uncertain); }
}
