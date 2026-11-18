"use client";

import { useActionState, useId, useState } from "react";
import { writeRecord } from "./record-actions";
import { emptyRecord, recordSections, type RecordDraft, type RecordKind, type RecordState } from "@/lib/admin/records-validation";
import styles from "./admin.module.css";

function RecordForm({ initial }: { initial: RecordDraft }) {
  const prefix = useId();
  const [values, setValues] = useState(initial.payload);
  const [dirty, setDirty] = useState(false);
  const [stored, setStored] = useState(initial);
  const [state, action, pending] = useActionState(async (previous: RecordState, form: FormData) => {
    const result = await writeRecord(previous, form);
    if (result.ok) { setValues(result.record.payload); setStored(result.record); setDirty(false); }
    return result;
  }, { record: initial, errors: {}, message: "", ok: false });
  if (state.deleted) return <p role="status" className={styles.success}>{state.message}</p>;
  const fields = { ...recordSections[initial.kind].fields, sort_order: { label: "Display order (lower numbers first)", max: 6, type: undefined, required: true } };
  return <form action={action} className={styles.editor}>
    <input type="hidden" name="kind" value={initial.kind} /><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="revision" value={stored.revision} />
    <fieldset disabled={pending} className={styles.panel}>
      <legend>{initial.revision === 0 ? "New record" : "Edit record"}</legend>
      <p>{dirty ? "Local edits — save to store. " : ""}Revision {stored.revision} / Published revision {stored.published_revision ?? "none"} / {stored.archived ? "Archived" : stored.published_revision === null ? "Draft" : "Published"}{stored.published_revision !== null && stored.revision > stored.published_revision ? " — unpublished changes" : ""}</p>
      <div className={styles.fields}>{Object.entries(fields).map(([key, field]) => {
        const value = values[key];
        const props = {
          id: `${prefix}-${key}`, name: key, value: Array.isArray(value) ? value.join("\n") : value ?? "",
          maxLength: field.max, required: field.required, "aria-invalid": Boolean(state.errors[key]),
          "aria-describedby": state.errors[key] ? `${prefix}-${key}-error` : undefined,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); },
        };
        return <div className={styles.field} key={key}>
          <label htmlFor={props.id}>{field.label}{field.required ? " *" : ""}</label>
          {field.type === "multiline" ? <textarea {...props} rows={4} /> : <input {...props} type={field.type === "date" ? "date" : field.type === "url" ? "url" : "text"} inputMode={key === "sort_order" ? "numeric" : undefined} />}
          {state.errors[key] && <span className={styles.error} id={`${prefix}-${key}-error`}>{state.errors[key]}</span>}
        </div>;
      })}</div>
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.secondary}`} name="intent" value="save">Save draft</button>
        <button className={`${styles.button} ${styles.primary}`} name="intent" value="publish">Publish / restore to database</button>
        {stored.revision > 0 && <button className={`${styles.button} ${styles.secondary}`} name="intent" value="archive" formNoValidate>Archive stored record</button>}
      </div>
      {stored.revision > 0 && <div className={styles.deleteControls}>
        <label><input type="checkbox" name="confirm_delete" value="yes" /> Permanently delete this record and its published database version</label>
        <button className={`${styles.button} ${styles.secondary}`} name="intent" value="delete" formNoValidate>Delete permanently</button>
      </div>}
      <p className={styles.note}>Archive and delete act on stored content; local edits are not saved. Save draft keeps the current published version. Publish also restores an archived record.</p>
    </fieldset>
    <p role="status" aria-live="polite" className={state.ok ? styles.success : styles.error}>{pending ? "Saving. Please wait…" : state.message}</p>
  </form>;
}

export function RecordEditors({ initial }: { initial: RecordDraft[] }) {
  const [newRecords, setNewRecords] = useState<RecordDraft[]>([]);
  return <section id="record-editors" className={styles.editor} aria-labelledby="records-heading">
    <div><h2 id="records-heading">Projects, experience & credentials</h2><p className={styles.note}>Enter only verified facts. Dates are optional except experience start dates. Order changes take effect in stored lists after reload; publish applies them to the database. The public website retains its current content.</p></div>
    {(Object.keys(recordSections) as RecordKind[]).map(kind => <section className={styles.editor} key={kind} id={`records-${kind}`} aria-labelledby={`heading-${kind}`}>
      <h3 id={`heading-${kind}`}>{recordSections[kind].label}</h3>
      {[...initial.filter(record => record.kind === kind).sort((a, b) => Number(a.payload.sort_order) - Number(b.payload.sort_order) || a.id.localeCompare(b.id)), ...newRecords.filter(record => record.kind === kind)].map(record =>
        <details className={styles.recordDisclosure} key={record.id} open={record.revision === 0 ? true : undefined}>
          <summary>{record.revision === 0 ? "New record" : String(record.payload.title ?? record.payload.role ?? record.payload.name ?? record.payload.qualification)}{record.payload.company ? ` · ${record.payload.company}` : ""}{record.archived ? " (archived)" : ""}</summary>
          <RecordForm initial={record} />
        </details>)}
      {!initial.some(record => record.kind === kind) && <p className={styles.note}>No stored records. Nothing has been prefilled.</p>}
      <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setNewRecords([...newRecords, emptyRecord(kind, crypto.randomUUID())])}>Add {recordSections[kind].label.toLowerCase()} record</button>
    </section>)}
  </section>;
}
