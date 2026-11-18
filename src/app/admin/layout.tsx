import type { Metadata } from "next";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <section className={styles.shell} aria-label="Administration"><div className={styles.workspace}>{children}</div></section>;
}
