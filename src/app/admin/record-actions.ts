"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { isRecordKind, oneText, validId, validateRecord, type RecordState } from "@/lib/admin/records-validation";
import { revalidatePath } from "next/cache";

export async function writeRecord(_previous: RecordState, form: FormData): Promise<RecordState> {
  const supabase = await requireAdmin();
  const kind = oneText(form, "kind");
  const id = oneText(form, "id");
  const intent = oneText(form, "intent");
  const revisionText = oneText(form, "revision");
  // Do not trust previous client state for any identifier, payload or revision.
  const failure = (message: string): RecordState => ({ record: { kind: "skills", id: "", payload: {}, revision: 0, published_revision: null, archived: false }, errors: {}, ok: false, message });
  if (!isRecordKind(kind) || !validId(id) || !intent || !["save", "publish", "archive", "delete"].includes(intent) || revisionText === null || !/^(0|[1-9]\d{0,8})$/.test(revisionText)) return failure("Invalid submission. Reload before retrying.");
  const revision = Number(revisionText);
  const { payload, errors } = validateRecord(kind, form);
  const result: RecordState = { record: { kind, id, payload, revision, published_revision: null, archived: false }, errors: {}, ok: false, message: "" };
  if (["save", "publish"].includes(intent) && Object.keys(errors).length) return { ...result, errors, message: "Review the highlighted fields. Nothing was saved." };
  if (intent === "delete" && oneText(form, "confirm_delete") !== "yes") return { ...result, message: "Select the permanent deletion confirmation first." };
  if (["archive", "delete"].includes(intent) && revision === 0) return { ...result, message: "Save the record before archiving or deleting." };
  try {
    const { data, error } = await supabase.rpc("write_record_editor", {
      record_kind: kind, record_id: id, content: ["save", "publish"].includes(intent) ? payload : {}, expected_revision: revision, operation: intent,
    });
    if (error || !Array.isArray(data) || data.length !== 1 || data[0].id !== id || data[0].revision !== revision + 1) return { ...result, message: error?.code === "40001" ? "A newer version exists. Copy local edits, then reload. Nothing was saved." : "Change could not be confirmed. Reload to check stored content before retrying." };
    if (intent !== "save") revalidatePath("/", "layout");
    return { ...result, record: data[0], ok: true, deleted: intent === "delete", message: ({ save: "Draft saved; published content is unchanged.", publish: "Published to the public portfolio.", archive: "Archived. Draft content was retained.", delete: "Permanently deleted." } as Record<string, string>)[intent] };
  } catch { return { ...result, message: "Change could not be confirmed. Reload to check stored content before retrying." }; }
}
