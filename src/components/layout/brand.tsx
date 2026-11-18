import { homeHref } from "./navigation-config";

export function Brand() {
  return (
    <a href={homeHref} className="site-brand" aria-label="Abdul Raheem, Home">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface font-mono text-sm font-semibold">AR<span className="text-highlight">.</span></span>
      <span className="min-w-0 text-sm font-semibold tracking-tight">Abdul Raheem<span className="mt-0.5 block font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-muted">Infrastructure / Cloud / DevOps</span></span>
    </a>
  );
}
