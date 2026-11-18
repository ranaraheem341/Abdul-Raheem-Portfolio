"use client";

import { useFormStatus } from "react-dom";
import styles from "../admin.module.css";

function Credentials({ configured, denied }: { configured: boolean; denied: boolean }) {
  const { pending } = useFormStatus();
  return <>
    <fieldset className={styles.loginFields} disabled={!configured || pending} aria-busy={pending}>
      <legend className={styles.srOnly}>Sign in credentials</legend>
      <div className={styles.field}>
        <label htmlFor="admin-email">Email</label>
        <input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-describedby={denied ? "login-error" : undefined} />
      </div>
      <div className={styles.field}>
        <label htmlFor="admin-password">Password</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" maxLength={1024} required aria-describedby={denied ? "login-error" : undefined} />
      </div>
      <button type="submit" className={`${styles.button} ${styles.primary}`}>{pending ? "Signing in…" : "Sign in"}</button>
    </fieldset>
    <p role="status" className={styles.note}>{pending ? "Signing in. Please wait…" : ""}</p>
  </>;
}

export function LoginForm({ action, configured, denied }: {
  action: (form: FormData) => Promise<void>;
  configured: boolean;
  denied: boolean;
}) {
  return <form action={action} className={styles.loginForm}><Credentials configured={configured} denied={denied} /></form>;
}
