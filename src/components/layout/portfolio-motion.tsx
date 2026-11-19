"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: server output and the first client render stay visible. */
export function PortfolioMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let stop = () => {};

    function configure() {
      stop();
      if (!root || preference.matches) return;
      const panels = root.querySelectorAll<HTMLElement>(".section-heading, [data-motion-reveal]");
      const loops = root.querySelectorAll<HTMLElement>("[data-motion-loop]");
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (element.hasAttribute("data-motion-loop")) {
            element.toggleAttribute("data-motion-active", entry.isIntersecting);
          } else if (entry.isIntersecting) {
            element.dataset.reveal = "visible";
            observer.unobserve(element);
          }
        }
      }, { threshold: 0 });

      // Keep on-screen content, restored scroll positions, and focused forms visible.
      for (const panel of panels) {
        if (panel.getBoundingClientRect().top >= window.innerHeight && !panel.contains(document.activeElement)) {
          observer.observe(panel);
          panel.dataset.reveal = "pending";
        }
      }
      loops.forEach((element) => observer.observe(element));

      // One delegated, frame-limited handler for service cards; no render loop or scroll handler.
      let tilted: HTMLElement | null = null;
      let frame = 0;
      let pointerX = 0;
      let pointerY = 0;
      function resetTilt() {
        window.cancelAnimationFrame(frame);
        frame = 0;
        tilted?.style.removeProperty("--tilt-x");
        tilted?.style.removeProperty("--tilt-y");
        tilted = null;
      }
      function tilt(event: PointerEvent) {
        if (!finePointer.matches || event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
        const card = event.target.closest<HTMLElement>("[data-motion-tilt]");
        if (card !== tilted) resetTilt();
        if (!card || !root?.contains(card)) return;
        tilted = card;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          if (!tilted) return;
          const rect = (tilted.parentElement ?? tilted).getBoundingClientRect();
          const x = Math.max(-1, Math.min(1, (pointerX - rect.left) / rect.width * 2 - 1));
          const y = Math.max(-1, Math.min(1, (pointerY - rect.top) / rect.height * 2 - 1));
          tilted.style.setProperty("--tilt-x", `${(-y * 1.6).toFixed(2)}deg`);
          tilted.style.setProperty("--tilt-y", `${(x * 1.6).toFixed(2)}deg`);
        });
      }
      function leaveTilt(event: PointerEvent) {
        if (!(event.relatedTarget instanceof Node) || !tilted?.contains(event.relatedTarget)) resetTilt();
      }
      function revealFocus(event: FocusEvent) {
        if (!(event.target instanceof Element)) return;
        // Reveal ancestors too, so a nested reveal can never conceal keyboard focus.
        let panel = event.target.closest<HTMLElement>("[data-reveal]");
        while (panel && root?.contains(panel)) {
          delete panel.dataset.reveal;
          observer.unobserve(panel);
          panel = panel.parentElement?.closest<HTMLElement>("[data-reveal]") ?? null;
        }
      }
      function revealHash() {
        const target = document.getElementById(window.location.hash.slice(1));
        if (!target || !root?.contains(target)) return;
        panels.forEach((panel) => {
          if (target === panel || target.contains(panel) || panel.contains(target)) {
            delete panel.dataset.reveal;
            observer.unobserve(panel);
          }
        });
      }
      function syncVisibility() {
        root?.toggleAttribute("data-motion-paused", document.hidden);
        if (document.hidden) resetTilt();
      }
      syncVisibility();
      revealHash();
      root.addEventListener("focusin", revealFocus);
      if (finePointer.matches) {
        root.addEventListener("pointermove", tilt, { passive: true });
        root.addEventListener("pointerout", leaveTilt);
        window.addEventListener("blur", resetTilt);
      }
      window.addEventListener("hashchange", revealHash);
      document.addEventListener("visibilitychange", syncVisibility);
      stop = () => {
        observer.disconnect();
        resetTilt();
        panels.forEach((panel) => delete panel.dataset.reveal);
        loops.forEach((element) => element.removeAttribute("data-motion-active"));
        root.removeAttribute("data-motion-paused");
        root.removeEventListener("focusin", revealFocus);
        root.removeEventListener("pointermove", tilt);
        root.removeEventListener("pointerout", leaveTilt);
        window.removeEventListener("blur", resetTilt);
        window.removeEventListener("hashchange", revealHash);
        document.removeEventListener("visibilitychange", syncVisibility);
      };
    }

    configure();
    preference.addEventListener("change", configure);
    finePointer.addEventListener("change", configure);
    return () => {
      stop();
      preference.removeEventListener("change", configure);
      finePointer.removeEventListener("change", configure);
    };
  }, []);

  return <div ref={rootRef} className="public-theme public-portfolio">{children}</div>;
}
