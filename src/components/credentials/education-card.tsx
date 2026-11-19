import { Badge, Card } from "@/components/ui";
import { educationStatusLabels, isPublishable, type EducationDefinition } from "./credentials-data";
import styles from "./credentials.module.css";
import { publicDate, type PublicRow } from "@/lib/public-portfolio";

export function PublishedEducationCard({ education }: { education: PublicRow<"education"> }) {
  return <article data-motion-reveal><Card className={styles.record}>
    <h4 className={styles.recordTitle}>{education.qualification}</h4>
    <p>{education.institution}</p>
    {(education.start_date || education.end_date) && <dl className={styles.facts}><div><dt>Attendance dates</dt>
      <dd>{[publicDate(education.start_date), publicDate(education.end_date)].filter(Boolean).join(" – ")}</dd></div></dl>}
    {education.description && <p className={styles.description}>{education.description}</p>}
  </Card></article>;
}

export function EducationCard({ education }: { education: EducationDefinition }) {
  if (!isPublishable(education)) return null;

  return (
    <article data-motion-reveal>
      <Card className={styles.record}>
        <Badge className={styles.badge} variant={education.status === "completed" ? "accent" : "default"}>
          {educationStatusLabels[education.status]}
        </Badge>
        <h4 className={styles.recordTitle}>{education.qualification}</h4>
        <p>{education.institution}</p>
        <dl className={styles.facts}>
          <div><dt>Field of study</dt><dd>{education.fieldOfStudy}</dd></div>
          <div><dt>Attendance / completion</dt><dd>{education.attendanceDates}</dd></div>
        </dl>
        {education.description && <p className={styles.description}>{education.description}</p>}
      </Card>
    </article>
  );
}
