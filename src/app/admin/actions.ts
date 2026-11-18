"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { validateProfile, type EditorState } from "@/lib/admin/profile-validation";
import { revalidatePath } from "next/cache";

export async function saveProfile(_previous: EditorState, form: FormData): Promise<EditorState> {
  const supabase = await requireAdmin();
  const { values, errors } = validateProfile(form);
  const revisionText = form.get("revision");
  const intent = form.get("intent");
  const validRevision = typeof revisionText === "string" && /^(0|[1-9]\d{0,8})$/.test(revisionText) && form.getAll("revision").length === 1;
  const revision = validRevision ? Number(revisionText) : 0;
  // Previous UI state is presentation only; it never authorizes or selects a write.
  const publishedRevision = Number.isSafeInteger(_previous?.publishedRevision) ? _previous.publishedRevision : null;
  const result: EditorState = { values, errors, revision, publishedRevision, message: "", ok: false };
  if (!validRevision || form.getAll("intent").length !== 1 || !["save", "publish"].includes(String(intent))) {
    return { ...result, message: "Invalid submission. Reload the editor before retrying." };
  }
  if (Object.keys(errors).length) return { ...result, message: "Review the highlighted fields. Nothing was saved." };
  try {
    const { data, error } = await supabase.rpc("write_profile_editor", {
      content: values, expected_revision: revision, publish_now: intent === "publish",
    });
    if (error || !Array.isArray(data) || data.length !== 1) {
      return { ...result, message: error?.code === "40001"
        ? "A newer version exists. Copy your edits, then reload before saving. Nothing was saved."
        : "Save could not be confirmed. Your edits remain here. Reload to check the stored version before retrying." };
    }
    if (intent === "publish") revalidatePath("/", "layout");
    return { ...result, revision: data[0].revision, publishedRevision: data[0].published_revision, ok: true,
      message: intent === "publish" ? "Published to the public portfolio." : "Draft saved. Published database content is unchanged." };
  } catch {
    return { ...result, message: "Save could not be confirmed. Your edits remain here. Reload to check the stored version before retrying." };
  }
}
