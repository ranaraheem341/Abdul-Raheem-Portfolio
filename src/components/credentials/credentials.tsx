import { Badge, Button, Card, Container, SectionHeading } from "@/components/ui";
import { CertificationCard, PublishedCertificationCard } from "./certification-card";
import { EducationCard, PublishedEducationCard } from "./education-card";
import { resume as fallbackResume, verifiedCertifications, verifiedEducation } from "./credentials-data";
import styles from "./credentials.module.css";
import { publicAsset, type PublicPortfolio } from "@/lib/public-portfolio";

export function Credentials({ content }: { content?: PublicPortfolio | null }) {
  const cv = content?.media.find((item) => item.purpose === "cv");
  const resume = content ? (cv ? { href: publicAsset(cv.id), downloadFilename: "cv.pdf" } : null) : fallbackResume;
  const hasEducation = content ? content.education.length > 0 : verifiedEducation.length > 0;
  const hasCertifications = content ? content.certifications.length > 0 : verifiedCertifications.length > 0;
  return (
    <section id="credentials" tabIndex={-1} aria-labelledby="credentials-title" className={styles.section}>
      <Container>
        <SectionHeading
          eyebrow="EDUCATION & CREDENTIALS"
          title="Qualifications & Professional Resume"
          headingId="credentials-title"
          description="Education, professional certifications, and a resume for your review."
        />
        <div className={styles.grid}>
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Education</h3>
            {hasEducation ? (
              <div className={styles.records}>
                {content ? content.education.map((record) => <PublishedEducationCard key={record.id} education={record} />) : verifiedEducation.map((record) => <EducationCard key={record.slug} education={record} />)}
              </div>
            ) : (
              <Card className={styles.empty}>
                <span className={styles.kicker}>Academic background</span>
                <p>Education details will be published once verified and approved for sharing.</p>
              </Card>
            )}
          </div>
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>Certifications</h3>
            {hasCertifications ? (
              <div className={styles.records}>
                {content ? content.certifications.map((record) => <PublishedCertificationCard key={record.id} certification={record} />) : verifiedCertifications.map((record) => <CertificationCard key={record.slug} certification={record} />)}
              </div>
            ) : (
              <Card className={styles.empty}>
                <span className={styles.kicker}>Professional credentials</span>
                <p>Verified certification details will be added as they become available.</p>
              </Card>
            )}
          </div>
        </div>
        <Card className={styles.resume}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" focusable="false">
              <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className={styles.resumeCopy}>
            <h3 className={styles.groupTitle}>Professional Resume</h3>
            <p className={styles.description}>
              {resume ? "Download the professional resume for a detailed overview of experience and qualifications." : "The resume is currently unavailable. An approved PDF will be added here when ready."}
            </p>
          </div>
          {resume ? (
            <Button href={resume.href} download={resume.downloadFilename} className={styles.action} aria-label="Download professional resume (PDF)">
              Download resume (PDF)
            </Button>
          ) : <Badge className={styles.badge}>PDF unavailable</Badge>}
        </Card>
      </Container>
    </section>
  );
}
