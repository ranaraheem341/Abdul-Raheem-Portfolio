import type { StaticImageData } from "next/image";

/** Supported subjects for future records; these are not completed-project claims. */
export const projectCategories = [
  "Windows Server & Active Directory",
  "Enterprise Networking",
  "Microsoft 365 Administration",
  "AWS & Linux Deployments",
  "Docker & Containerization",
  "CI/CD Automation",
  "Infrastructure Automation",
] as const;

export const caseStudyFields = [
  { key: "objective", label: "Problem / Objective" },
  { key: "environment", label: "Technical Environment" },
  { key: "implementation", label: "Solution / Implementation" },
  { key: "tools", label: "Tools and Technologies" },
  { key: "validation", label: "Testing / Validation" },
  { key: "outcome", label: "Outcome / Evidence" },
  { key: "lessons", label: "Lessons Learned" },
] as const;

export type CaseStudy = Partial<Record<(typeof caseStudyFields)[number]["key"], string>>;
export type ProjectStatus = "in-progress" | "completed" | "maintained" | "archived";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  "in-progress": "In progress",
  completed: "Completed",
  maintained: "Maintained",
  archived: "Archived",
};

export interface ProjectDefinition {
  /** Unique, URL-safe slug. */
  slug: string;
  title: string;
  category: (typeof projectCategories)[number];
  description: string;
  technologies: readonly string[];
  status: ProjectStatus;
  verification: "pending" | "verified";
  /** Approved documentation references, kept out of the public presentation. */
  evidenceReferences: readonly string[];
  repositoryUrl?: `https://${string}`;
  liveDemoUrl?: `https://${string}`;
  caseStudy?: CaseStudy;
  screenshots?: readonly {
    image: StaticImageData;
    alt: string;
    caption?: string;
  }[];
}

/**
 * No verified project records exist in PROJECT_SPEC.md or PROGRESS.md.
 * Add only owner-approved, public-safe facts and checked URLs/assets. Every
 * populated case-study field and screenshot must be covered by the evidence.
 */
export const projects: readonly ProjectDefinition[] = [];

/** Pending records and records without documented evidence are never published. */
export const verifiedProjects = projects.filter(
  (project) => project.verification === "verified" &&
    project.evidenceReferences.some((reference) => reference.trim().length > 0),
);
