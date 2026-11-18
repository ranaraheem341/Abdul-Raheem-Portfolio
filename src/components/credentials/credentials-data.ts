interface PublicationEvidence {
  /** Covers every published field, including status and any credential URL/ID. */
  verification: "pending" | "verified";
  evidenceReferences: readonly string[];
}

export interface EducationDefinition extends PublicationEvidence {
  slug: string;
  qualification: string;
  institution: string;
  fieldOfStudy: string;
  attendanceDates: string;
  status: "completed" | "in-progress" | "incomplete";
  description?: string;
}

export interface CertificationDefinition extends PublicationEvidence {
  slug: string;
  name: string;
  issuer: string;
  status: "completed" | "in-progress";
  issueDate?: string;
  expirationDate?: string;
  /** Include only when separately approved for public display. */
  credentialId?: string;
  credentialUrl?: `https://${string}`;
}

export interface ResumeDefinition {
  /** Existing, owner-approved, public-safe PDF under public/resume/. */
  href: `/resume/${string}.pdf`;
  downloadFilename: `${string}.pdf`;
  evidenceReferences: readonly string[];
}

export const educationStatusLabels: Record<EducationDefinition["status"], string> = {
  completed: "Completed",
  "in-progress": "In progress",
  incomplete: "Not completed",
};

/** No approved education, certification, or study records are available. */
export const education: readonly EducationDefinition[] = [];
export const certifications: readonly CertificationDefinition[] = [];

export function isPublishable(record: PublicationEvidence) {
  return record.verification === "verified" &&
    record.evidenceReferences.some((reference) => reference.trim().length > 0);
}

export const verifiedEducation = education.filter(isPublishable);
export const verifiedCertifications = certifications.filter(isPublishable);

/**
 * Keep null until the original approved PDF exists at the configured path.
 * Approval must cover its contents and privacy; do not generate a substitute.
 * Suggested download filename: Abdul-Raheem-Resume.pdf.
 */
export const resume: ResumeDefinition | null = null;
