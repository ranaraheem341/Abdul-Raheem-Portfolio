"use client";
import Image from "next/image";
import { useActionState, useId } from "react";
import { useRouter } from "next/navigation";
import { writeMedia } from "./media-actions";
import type { MediaItem, MediaPurpose, MediaState } from "@/lib/admin/media-validation";
import type { RecordDraft } from "@/lib/admin/records-validation";
import styles from "./admin.module.css";

function UploadForm({ purpose, projects }: { purpose: MediaPurpose; projects: RecordDraft[] }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(writeMedia, { ok: false, message: "" });
  const label = purpose === "photo" ? "Profile photo" : purpose === "cv" ? "CV PDF" : "Project screenshot";
  return <form action={action} className={styles.editor}>
    <input type="hidden" name="intent" value="upload" /><input type="hidden" name="purpose" value={purpose} />
    <fieldset className={styles.panel} disabled={pending || (purpose === "screenshot" && !projects.length)}>
      <legend>{label}: upload / replacement</legend>
      <p>New files start as drafts. Publish a replacement when ready, then remove the old file. Maximum 5 MiB per file.</p>
      {purpose === "screenshot" ? <div className={styles.field}><label htmlFor={`${prefix}-project`}>Saved project</label><select id={`${prefix}-project`} name="project_id" required>{projects.map(project => <option key={project.id} value={project.id}>{String(project.payload.title)}</option>)}</select></div> : <input type="hidden" name="project_id" value="" />}
      <div className={styles.field}><label htmlFor={`${prefix}-file`}>{label} file</label><input id={`${prefix}-file`} type="file" name="file" required accept={purpose === "cv" ? ".pdf,application/pdf" : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"} /></div>
      <div className={styles.field}><label htmlFor={`${prefix}-alt`}>{purpose === "cv" ? "Description (optional)" : "Image alternative text (optional)"}</label><input id={`${prefix}-alt`} name="alt_text" maxLength={300} aria-describedby={purpose === "cv" ? undefined : `${prefix}-alt-help`} />{purpose !== "cv" && <p id={`${prefix}-alt-help`}>Leave empty for decorative images. For meaningful images, describe the person or information shown (up to 300 characters).</p>}</div>
      <div className={styles.actions}><button className={`${styles.button} ${styles.secondary}`}>{pending ? "Uploading?" : "Upload private draft"}</button></div>
    </fieldset>
    <p role="status" className={state.ok ? styles.success : styles.error}>{state.message}</p>
  </form>;
}
function FileControls({ item }: { item: MediaItem }) {
  const [state, action, pending] = useActionState<MediaState, FormData>(writeMedia, { ok: false, message: "" });
  return <article className={styles.panel}>
    <h3>{item.purpose === "photo" ? "Profile photo" : item.purpose === "cv" ? "CV PDF" : "Project screenshot"}</h3>
    <p>{item.deleting ? "Removal pending ? retry removal" : item.published ? "Published in database" : "Private draft"} ? Revision {item.revision} ? {Math.ceil(item.size_bytes/1024)} KiB</p>
    {item.purpose === "screenshot" && <p>Project ID: {item.draft_project_id}</p>}
    {!item.deleting && (item.mime_type.startsWith("image/") ? <Image src={`/admin/media/${item.id}`} alt={item.alt_text} width={640} height={400} unoptimized className={styles.mediaPreview} /> : <a href={`/admin/media/${item.id}`}>Download stored CV PDF</a>)}
    <form action={action}>
      <input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} />
      <fieldset className={styles.mediaControls} disabled={pending}>
        {!item.deleting && <div className={styles.actions}><button className={`${styles.button} ${styles.secondary}`} name="intent" value={item.published ? "unpublish" : "publish"}>{item.published ? "Return to draft" : "Publish file"}</button></div>}
        <div className={styles.deleteControls}><label><input type="checkbox" name="confirm_delete" value="yes" /> Confirm permanent file removal</label><button className={`${styles.button} ${styles.secondary}`} name="intent" value="delete">Remove file</button></div>
      </fieldset>
      <p role="status" className={state.ok ? styles.success : styles.error}>{pending ? "Updating?" : state.message}</p>
    </form>
  </article>;
}
export function MediaEditor({ items, projects }: { items: MediaItem[]; projects: RecordDraft[] }) {
  const router = useRouter();
  return <section className={styles.editor} id="media-editor" aria-labelledby="media-heading">
    <h2 id="media-heading">Profile photo, CV & project screenshots</h2>
    <p className={styles.note}>All files and previews require administrator access, including published files. Publication records readiness in the database; public website integration is pending. Save projects and reload this list before attaching screenshots. Publish the project before publishing its screenshots. Remove screenshots before permanently deleting a project.</p>
    <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => router.refresh()}>Reload stored projects & files</button>
    {(["photo","cv","screenshot"] as const).map(purpose => <UploadForm key={purpose} purpose={purpose} projects={projects.filter(project => project.kind === "projects")} />)}
    {items.filter(item => item.purpose !== "legacy").map(item => <FileControls key={`${item.id}-${item.revision}`} item={item} />)}
    {!items.length && <p>No stored files.</p>}
  </section>;
}
