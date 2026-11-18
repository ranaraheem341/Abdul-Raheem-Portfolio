"use client";

import { useEffect, useRef, useState } from "react";
import { NavigationItems } from "./navigation-items";
import { sections } from "./navigation-config";

export interface MobileNavigationProps {
  activeId: string | null;
}

/** A nonmodal disclosure: normal Tab order, no focus trap or dialog semantics. */
export function MobileNavigation({ activeId }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (open && event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (open && event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    const desktop = window.matchMedia("(min-width: 72rem)");
    function onDesktop(event: MediaQueryListEvent) {
      if (!event.matches) return;
      const focusWasInside = wrapperRef.current?.contains(document.activeElement);
      setOpen(false);
      if (focusWasInside) document.querySelector<HTMLAnchorElement>(".desktop-navigation a")?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="mobile-navigation" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={toggleRef} type="button" className="mobile-menu-toggle" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="mobile-navigation-panel" onClick={() => setOpen(!open)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      <div id="mobile-navigation-panel" className="mobile-menu-panel" hidden={!open}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
          <p className="eyebrow">Explore the portfolio</p><span className="font-mono text-[10px] text-muted">{String(sections.filter((section) => section.status === "available").length).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}</span>
        </div>
        <nav aria-label="Mobile navigation">
          <ul className="mobile-menu-list">
            <NavigationItems activeId={activeId} onNavigate={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              setOpen(false);
              const id = new URL(event.currentTarget.href).hash.slice(1);
              document.getElementById(id)?.focus({ preventScroll: true });
            }} />
          </ul>
        </nav>

      </div>
    </div>
  );
}
