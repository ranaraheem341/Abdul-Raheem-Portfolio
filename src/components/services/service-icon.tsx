import type { ServiceIconName } from "./services-data";

const paths: Record<ServiceIconName, string> = {
  containers: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  workflow: "M4 3h6v6H4z M14 15h6v6h-6z M7 9v8h7 M10 6h7v9 M14 12l3 3 3-3",
  cloud: "M6 17a4 4 0 0 1-1-7.87A7 7 0 0 1 18.5 8a4.5 4.5 0 0 1 .5 9 M9 17l3-3 3 3 M12 14v7",
  support: "M3 3h18v7H3z M6 6.5h.01 M10 6.5h7 M3 14h10v7H3z M6 17.5h.01 M17 14h4v7h-4z",
};

export function ServiceIcon({ name }: { name: ServiceIconName }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
