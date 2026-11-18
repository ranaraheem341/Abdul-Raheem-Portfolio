import type { MouseEventHandler } from "react";
import { sections, sectionHref } from "./navigation-config";

export interface NavigationItemsProps {
  activeId?: string | null;
  onNavigate?: MouseEventHandler<HTMLAnchorElement>;
}

export function NavigationItems({ activeId, onNavigate }: NavigationItemsProps) {
  return sections.map((section) => (
    <li key={section.id}>
      {section.status === "available" ? (
        <a href={sectionHref(section)} className="site-nav-link" aria-current={activeId === section.id ? "location" : undefined} onClick={onNavigate}>
          {section.label}
        </a>
      ) : (
        <span className="site-nav-link site-nav-pending" role="link" aria-disabled="true" title={`${section.label} section coming soon`}>
          {section.label}<span className="sr-only"> — coming soon</span>
        </span>
      )}
    </li>
  ));
}
