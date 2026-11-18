import type { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { SiteChrome } from "./site-chrome";

export interface SiteLayoutProps {
  children: ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <SiteChrome header={<Header />} footer={<Footer />}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
    </SiteChrome>
  );
}
