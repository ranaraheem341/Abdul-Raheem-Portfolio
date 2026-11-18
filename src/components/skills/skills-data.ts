export type SkillIcon = "server" | "network" | "support" | "cloud" | "tools";

export interface SkillCategory {
  readonly id: string;
  readonly title: string;
  readonly icon: SkillIcon;
  readonly description: string;
  readonly skills: readonly string[];
  readonly note?: string;
}

export const skillCategories: readonly SkillCategory[] = [
  {
    id: "infrastructure",
    title: "IT Infrastructure & System Administration",
    icon: "server",
    description: "Systems, identity, and the foundations of everyday IT operations.",
    skills: ["Windows Server", "Active Directory", "Group Policy", "DNS / DHCP", "System Administration", "IT Asset Management"],
  },
  {
    id: "networking",
    title: "Enterprise Networking",
    icon: "network",
    description: "Connectivity, network configuration, and practical troubleshooting.",
    skills: ["Cisco Networking", "MikroTik", "LAN / WAN", "Network Troubleshooting", "Network Configuration"],
  },
  {
    id: "microsoft-support",
    title: "Microsoft Technologies & IT Support",
    icon: "support",
    description: "Workplace tools, desktop support, and end-user assistance.",
    skills: ["Microsoft 365", "Outlook", "Desktop Support", "Hardware/Software Troubleshooting", "Helpdesk Operations"],
  },
  {
    id: "cloud-devops",
    title: "Cloud & DevOps",
    icon: "cloud",
    description: "Developing capabilities in cloud deployment and delivery automation.",
    skills: ["AWS EC2", "Linux / Ubuntu", "Docker", "Docker Compose", "GitHub Actions", "CI/CD Pipelines", "VPS Deployment"],
    note: "These capabilities reflect continued development and intended service offerings; professional production experience has not been verified.",
  },
  {
    id: "additional-tools",
    title: "Additional Tools",
    icon: "tools",
    description: "Reporting, documentation, and supporting IT operations.",
    skills: ["Power BI", "Technical Documentation", "IT Operations"],
  },
];
