"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "./actions";
import { profileFields, type EditorState, type ProfileField } from "@/lib/admin/profile-validation";
import styles from "./admin.module.css";

export function ProfileEditor({ initial }: { initial: EditorState }) {
  const [values, setValues] = useState(initial.values);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(async (previous: EditorState, form: FormData) => {
    const result = await saveProfile(previous, form);
    if (result.ok) { setValues(result.values); setDirty(false); }
    return result;
  }, initial);
  function field(key: ProfileField, multiline = false) {
    const config = profileFields[key];
    const props = {
      id: `editor-${key}`, name: key, value: values[key], maxLength: config.max,
      required: key === "full_name", "aria-invalid": Boolean(state.errors[key]),
      "aria-describedby": state.errors[key] ? `${key}-error` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues({ ...values, [key]: event.target.value }); setDirty(true);
      },
    };
    return <div className={styles.field} key={key}>
      <label htmlFor={props.id}>{config.label}{key === "full_name" ? " *" : ""}</label>
      {multiline ? <textarea {...props} rows={key === "biography" ? 7 : 4} /> :
        <input {...props} type={key === "public_email" ? "email" : ["linkedin", "fiverr", "github", "upwork"].includes(key) ? "url" : "text"} />}
      {state.errors[key] && <span id={`${key}-error`} className={styles.error}>{state.errors[key]}</span>}
    </div>;
  }
  return <form action={action} className={styles.editor}>
    <input type="hidden" name="revision" value={state.revision} />
    <fieldset disabled={pending} className={styles.panel} id="profile-editor">
      <legend>01 / Profile</legend><h2>Your professional identity</h2>
      <p>Write in your own voice. Your name is required; all other fields are optional.</p>
      <div className={styles.fields}>{field("full_name")}{field("headline")}</div>
      {field("biography", true)}{field("professional_summary", true)}
    </fieldset>
    <fieldset disabled={pending} className={styles.panel} id="contact-editor">
      <legend>02 / Social & contact</legend><h2>Make the right connections</h2>
      <p>Use HTTPS links on each platform’s official domain. Leave a field empty to remove it on publish.</p>
      <div className={styles.fields}>{field("linkedin")}{field("fiverr")}{field("github")}{field("upwork")}{field("public_email")}</div>
    </fieldset>
    <div className={styles.savebar}>
      <div><strong>{dirty ? "Local edits — save to store" : `Stored draft revision ${state.revision}`}</strong><p>Save a private draft or publish these fields to the database.</p></div>
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.secondary}`} name="intent" value="save" disabled={pending}>Save draft</button>
        <button className={`${styles.button} ${styles.primary}`} name="intent" value="publish" disabled={pending}>Publish to database</button>
      </div>
    </div>
    <p role="status" aria-live="polite" className={state.ok ? styles.success : styles.error}>{pending ? "Saving. Please wait…" : state.message}</p>
    <p className={styles.note}>Published revision: {state.publishedRevision ?? "none recorded"}. {state.publishedRevision !== null && state.revision > state.publishedRevision ? "The saved draft has unpublished changes." : ""} The public portfolio continues to use its existing content.</p>
  </form>;
}
