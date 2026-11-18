"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function SiteChrome({ children, header, footer }: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  return <>{!admin && header}{children}{!admin && footer}</>;
}
