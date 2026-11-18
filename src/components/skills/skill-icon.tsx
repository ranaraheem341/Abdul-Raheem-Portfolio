import type { SkillIcon as SkillIconName } from "./skills-data";

const paths: Record<SkillIconName, string> = {
  server: "M4 3h16v7H4z M4 14h16v7H4z M7 6.5h.01 M7 17.5h.01 M11 6.5h6 M11 17.5h6",
  network: "M9 3h6v5H9z M2 16h6v5H2z M16 16h6v5h-6z M12 8v4 M5 16v-4h14v4",
  support: "M3 4h18v13H3z M8 21h8 M12 17v4 M8 8l-2 2 2 2 M16 8l2 2-2 2",
  cloud: "M6 17a4 4 0 0 1-1-7.87A7 7 0 0 1 18.5 8a4.5 4.5 0 0 1 .5 9 M9 16l3-3 3 3 M12 13v8",
  tools: "M4 3h10l6 6v12H4z M14 3v6h6 M8 17v-3 M12 17v-6 M16 17v-4",
};

export function SkillIcon({ name }: { name: SkillIconName }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
