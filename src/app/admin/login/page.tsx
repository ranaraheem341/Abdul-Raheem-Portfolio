import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { login } from "./actions";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const configured = Boolean(getSupabaseConfig());
  return (
    <div className={styles.loginStage}>
      <div className={styles.loginCard}>
        <header className={styles.heading}>
          <span className={styles.eyebrow}>Portfolio / Studio</span>
          <h1>Admin sign in</h1>
          <p>Welcome back. Sign in to manage your portfolio.</p>
        </header>
        <p className={styles.note}>Access is restricted to the configured portfolio administrator.</p>
        {!configured || status === "unavailable" ? <p id="login-status" role="status" className={styles.error}>Admin services are not configured.</p> : null}
        {status === "denied" ? <p id="login-error" role="alert" className={styles.error}>Unable to sign in or access admin. Check your credentials and admin access.</p> : null}
        <LoginForm action={login} configured={configured} denied={status === "denied"} />
        <Link className={styles.backLink} href="/">Back to portfolio</Link>
      </div>
    </div>
  );
}
