import { Card, Container, SectionHeading } from "@/components/ui";
import { contactLinks, type ContactDefinition } from "@/components/layout/navigation-config";
import { ContactForm } from "./contact-form";
import styles from "./contact.module.css";

export function Contact({ links = contactLinks }: { links?: readonly ContactDefinition[] }) {
  const activeLinks = links.filter((link) => link.href);
  return (
    <section id="contact" tabIndex={-1} aria-labelledby="contact-title" className={styles.section}>
      <Container>
        <SectionHeading eyebrow="LET'S CONNECT" title="Let's Build Something Extraordinary" headingId="contact-title"
          description="Whether you need help with IT infrastructure, networking, Windows Server administration, cloud deployment, or DevOps workflows, I'd be happy to discuss your project or professional opportunity." />
        <div className={styles.layout}>
          <aside className={styles.intro} aria-labelledby="contact-options-title">
            <span className="eyebrow">A good conversation starts here</span>
            <h3 id="contact-options-title" className={styles.subtitle}>Projects &amp; professional opportunities</h3>
            <p>Have an infrastructure challenge, a deployment in mind, or a role to discuss? Share a little context so we can start with what matters to you.</p>
            <ul className={styles.topics}>
              <li>Freelance projects &amp; technical consultation</li>
              <li>Recruiter inquiries &amp; job opportunities</li>
              <li>Professional connections &amp; general questions</li>
            </ul>
            <div className={styles.connections}>
              <h4>Connect directly</h4>
              {activeLinks.length ? <ul>{activeLinks.map(({ label, href }) => <li key={label}><a href={href!}>{label}<span aria-hidden="true"> ↗</span></a></li>)}</ul> : <p>Verified contact links will be added when available.</p>}
            </div>
          </aside>
          <Card className={styles.panel}><ContactForm /></Card>
        </div>
      </Container>
    </section>
  );
}
