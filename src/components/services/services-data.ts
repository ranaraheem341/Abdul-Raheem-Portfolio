import { contactLinks } from "@/components/layout/navigation-config";

export type ServiceIconName = "containers" | "workflow" | "cloud" | "support";
export type FiverrUrl = `https://www.fiverr.com/${string}`;

export interface ServiceDefinition {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly icon: ServiceIconName;
  readonly offerings: readonly string[];
  /** Set only after the owner supplies a verified, published gig URL. */
  readonly gigUrl: FiverrUrl | null;
}

export const services: readonly ServiceDefinition[] = [
  {
    id: "docker", category: "Container deployment", title: "Docker & Docker Compose", icon: "containers",
    description: "Containerize applications, configure Docker Compose environments, and assist with reproducible application deployment.",
    offerings: ["Docker installation and configuration", "Application containerization", "Docker Compose setup", "Container troubleshooting", "Deployment documentation"],
    gigUrl: null,
  },
  {
    id: "cicd", category: "Delivery automation", title: "GitHub Actions & CI/CD", icon: "workflow",
    description: "Build and configure automated workflows that support consistent application testing and deployment.",
    offerings: ["GitHub Actions workflows", "Automated build pipelines", "CI/CD configuration", "Workflow troubleshooting", "Deployment automation"],
    gigUrl: null,
  },
  {
    id: "cloud", category: "Cloud & VPS", title: "AWS EC2 & Ubuntu VPS", icon: "cloud",
    description: "Configure cloud and Linux server environments for application deployment, basic security configuration, and ongoing maintenance.",
    offerings: ["AWS EC2 setup", "Ubuntu VPS configuration", "Web application deployment", "Web server configuration", "Basic server hardening"],
    gigUrl: null,
  },
  {
    id: "infrastructure", category: "IT infrastructure & support", title: "Windows Server & IT Support", icon: "support",
    description: "Provide assistance with Windows Server, Active Directory, Group Policy, networking, Microsoft 365, and enterprise IT troubleshooting.",
    offerings: ["Windows Server administration", "Active Directory and Group Policy", "DNS/DHCP troubleshooting", "Cisco and MikroTik networking support", "Microsoft 365 and Outlook troubleshooting"],
    gigUrl: null,
  },
];

// Centralized contacts are owner-verified before configuration; never infer a seller URL.
export const fiverrProfileHref = contactLinks.find((contact) => contact.label === "Fiverr")?.href ?? null;
export const emailHref = contactLinks.find((contact) => contact.label === "Email")?.href ?? null;

export function serviceDestination(service: ServiceDefinition) {
  const fiverrHref = service.gigUrl ?? fiverrProfileHref;
  if (fiverrHref) return { href: fiverrHref, label: "Explore on Fiverr" };
  if (emailHref) return { href: emailHref, label: "Discuss this service" };
  return null;
}
