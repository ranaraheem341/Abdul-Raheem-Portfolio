import { Badge, Card, Container, SectionHeading } from "@/components/ui";
import styles from "./experience.module.css";
import { publicDate, type PublicRow } from "@/lib/public-portfolio";

const experiences = [
  {
    id: "salsoft",
    position: "IT Executive",
    company: "Salsoft Technologies",
    start: { dateTime: "2026-01", label: "January 2026" },
    end: null,
    focus: [
      "IT infrastructure support",
      "Windows Server and Active Directory",
      "Network troubleshooting",
      "Microsoft 365 support",
      "IT operations",
    ],
  },
  {
    id: "fp-energy",
    position: "IT Support Technician",
    company: "FP Energy",
    start: { dateTime: "2024-07", label: "July 2024" },
    end: { dateTime: "2025-12", label: "December 2025" },
    focus: [
      "Hardware/software troubleshooting",
      "End-user technical support",
      "Network connectivity",
      "System maintenance",
      "IT inventory and support operations",
    ],
  },
] as const;

export function Experience({ records }: { records?: PublicRow<"experience">[] }) {
  const entries = records ? records.map((row) => ({ id: row.id, position: row.role, company: row.company,
    start: { dateTime: row.start_date, label: publicDate(row.start_date) },
    end: row.end_date ? { dateTime: row.end_date, label: publicDate(row.end_date) } : null, focus: row.highlights })) : experiences;
  return (
    <section id="experience" tabIndex={-1} aria-labelledby="experience-title" className={styles.section}>
      <Container>
        <SectionHeading eyebrow="Career journey" title="Professional Experience" headingId="experience-title" description="A background in technical support, infrastructure, and day-to-day IT operations." />
        <ol className={styles.timeline} role="list" data-motion-stagger>
          {entries.map((experience, index) => (
            <li key={experience.id} className={styles.entry} data-motion-reveal>
              <span className={styles.marker} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <article aria-labelledby={`${experience.id}-title`} className={styles.article}>
                <Card className={styles.card}>
                  <div className={styles.header}>
                    <div className={styles.identity}>
                      <h3 id={`${experience.id}-title`} className={styles.position}>{experience.position}</h3>
                      <p className={styles.company}>{experience.company}</p>
                    </div>
                    <div className={styles.period}>
                      {!experience.end && <Badge variant="accent">Current role</Badge>}
                      <p>
                        <time dateTime={experience.start.dateTime}>{experience.start.label}</time>
                        {" – "}
                        {experience.end ? <time dateTime={experience.end.dateTime}>{experience.end.label}</time> : "Present"}
                      </p>
                    </div>
                  </div>
                  <p className={styles.focusLabel}>Focus areas</p>
                  <ul className={styles.focus} role="list">
                    {experience.focus.map((area) => <li key={area}>{area}</li>)}
                  </ul>
                </Card>
              </article>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
