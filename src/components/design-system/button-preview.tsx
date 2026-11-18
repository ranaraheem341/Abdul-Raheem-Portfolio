"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ButtonPreview() {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes} aria-controls="button-notes">{showNotes ? "Hide notes" : "Show notes"} <span aria-hidden="true">{showNotes ? "−" : "+"}</span></Button>
        <Button href="#typography" variant="secondary">Typography <span aria-hidden="true">↗</span></Button>
        <Button href="#foundations" variant="outline" size="sm">Foundations</Button>
      </div>
      <p className="mt-5 font-mono text-[10px] text-muted">Primary / Large · Secondary / Medium · Outline / Small</p>
      <div id="button-notes" hidden={!showNotes} className="mt-5 rounded-control border border-border bg-surface p-4 text-sm text-muted">
        Links navigate to a destination; buttons perform an action. Try Tab to explore the focus indicators, then Enter or Space to toggle these notes.
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <Button disabled size="sm">Unavailable</Button><p className="text-xs text-muted">A clear disabled state.</p>
      </div>
    </div>
  );
}
