import Link from "next/link";
import { getMediaEditor } from "@/lib/admin/media";
import { MediaEditor } from "./media-editor";
import { getProfileEditor } from "@/lib/admin/profile";
import { getRecordEditors } from "@/lib/admin/records";
import { RecordEditors } from "./record-editors";
import { logout } from "./login/actions";
import { ProfileEditor } from "./profile-editor";
import styles from "./admin.module.css";

const navigation = <>
  <a href="#dashboard">Overview</a><a href="#profile-editor">Profile</a><a href="#contact-editor">Social & contact</a>
  <a href="#record-editors">Projects & credentials</a><a href="#media-editor">Photo, CV & screenshots</a>
</>;

export default async function AdminPage() {
  const editor = await getProfileEditor();
  const records = await getRecordEditors();
  const media = await getMediaEditor();
  return <div className={styles.dashboard}>
    <aside className={styles.sidebar} aria-label="Admin sidebar">
      <div><span className={styles.eyebrow}>Portfolio / Studio</span><p className={styles.brand}>Admin workspace<span>Profile & connections</span></p></div>
      <nav aria-label="Admin navigation">{navigation}</nav>
      <div className={styles.sidebarBottom}><Link href="/">View portfolio ↗</Link>
        <form action={logout}><button className={`${styles.button} ${styles.secondary}`}>Sign out</button></form>
      </div>
    </aside>
    <div className={styles.content}>
      <details className={styles.mobileNav}><summary>Workspace navigation</summary><nav aria-label="Mobile admin navigation">{navigation}<Link href="/">View portfolio ↗</Link></nav><form action={logout}><button className={`${styles.button} ${styles.secondary}`}>Sign out</button></form></details>
      <header className={styles.heading} id="dashboard"><span className={styles.eyebrow}>Your portfolio, thoughtfully managed</span><h1>Profile dashboard</h1><p>Shape your introduction and keep your professional connections up to date.</p></header>
      <div className={styles.overview}>
        <article><span>Workspace</span><strong>Private & protected</strong><p>Restricted to your administrator account.</p></article>
        <article><span>Publishing</span><strong>{editor ? "Editor ready" : "Unavailable"}</strong><p>Publishing updates stored content. Public integration is pending.</p></article>
      </div>
      {editor ? <ProfileEditor initial={{ ...editor, errors: {}, message: "", ok: false }} /> :
        <div className={styles.panel} role="alert"><h2>Editor unavailable</h2><p>Profile data could not be loaded. Check the database connection and apply migrations 001 and 002, then reload. Editing is disabled to protect stored content.</p></div>}
      {records ? <RecordEditors initial={records} /> : <div id="record-editors" className={styles.panel} role="alert"><h2>Experience editors unavailable</h2><p>Check the database connection and apply migration 003, then reload. Editing is disabled to protect existing records.</p></div>}
      {media && records ? <MediaEditor items={media} projects={records} /> : <div id="media-editor" className={styles.panel} role="alert"><h2>Media editor unavailable</h2><p>Check the database connection and apply migration 004, then reload. Uploading is disabled.</p></div>}
    </div>
  </div>;
}
