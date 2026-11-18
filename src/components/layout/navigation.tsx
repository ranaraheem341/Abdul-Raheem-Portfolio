"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileNavigation } from "./mobile-navigation";
import { NavigationItems } from "./navigation-items";
import { sections } from "./navigation-config";

export function Navigation() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" || !("IntersectionObserver" in window)) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
        else visible.delete(entry.target.id);
      }
      setActiveId([...visible.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? null);
    }, { rootMargin: "-80px 0px -55% 0px", threshold: 0 });

    sections.filter((section) => section.status === "available").forEach((section) => {
      const target = document.getElementById(section.id);
      if (target) observer.observe(target);
    });
    return () => observer.disconnect();
  }, [pathname]);

  const currentId = pathname === "/" ? activeId : null;
  return (
    <>
      <nav aria-label="Main navigation" className="desktop-navigation">
        <ul className="flex items-center gap-1"><NavigationItems activeId={currentId} /></ul>
      </nav>
      <MobileNavigation key={pathname} activeId={currentId} />
    </>
  );
}
