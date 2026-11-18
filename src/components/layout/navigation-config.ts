export interface SectionDefinition {
  id: string;
  label: string;
  status: "available" | "pending";
}

/** Activate a section only after its matching ID exists on the homepage. */
export const sections: readonly SectionDefinition[] = [
  { id: "home", label: "Home", status: "available" },
  { id: "about", label: "About", status: "available" },
  { id: "experience", label: "Experience", status: "available" },
  { id: "skills", label: "Skills", status: "available" },
  { id: "services", label: "Services", status: "available" },
  { id: "projects", label: "Projects", status: "available" },
  { id: "credentials", label: "Credentials", status: "available" },
  { id: "contact", label: "Contact", status: "available" },
];

export const homeHref = "/#home";

export function sectionHref(section: SectionDefinition) {
  return `/#${section.id}`;
}

export interface ContactDefinition {
  label: string;
  href: `https://${string}` | `mailto:${string}` | null;
}

/** Replace null only with an owner-supplied, verified destination. */
export const contactLinks: readonly ContactDefinition[] = [
  { label: "LinkedIn", href: null },
  { label: "GitHub", href: null },
  { label: "Fiverr", href: null },
  { label: "Upwork", href: null },
  { label: "Email", href: null },
];

export const expertise = [
  "IT Infrastructure", "Enterprise Networking", "Windows Server",
  "Microsoft 365", "Cloud Deployment", "DevOps Automation",
] as const;
