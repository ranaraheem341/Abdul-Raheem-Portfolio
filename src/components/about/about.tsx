import { Card, Container, SectionHeading } from "@/components/ui";
import styles from "./about.module.css";
import type { PublicPortfolio } from "@/lib/public-portfolio";

export function About({ profile }: { profile?: PublicPortfolio["profile"] }) {
  return (
    <section id="about" tabIndex={-1} aria-labelledby="about-title" className={styles.section}>
      <Container>
        <div className={styles.layout}>
          <SectionHeading eyebrow="Background & direction" title="About Me" headingId="about-title" description="Grounded in infrastructure. Building toward the cloud." />
          <div className={styles.content}>
            <div className={styles.description} data-motion-stagger>
              {profile ? profile.biography.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} data-motion-reveal>{paragraph}</p>) : <>
              <p data-motion-reveal>I&apos;m an IT infrastructure professional with experience in enterprise IT support, Windows Server administration, networking, Microsoft 365, and infrastructure operations.</p>
              <p data-motion-reveal>My professional background includes supporting business-critical technology environments, troubleshooting systems and networks, and maintaining reliable IT services.</p>
              <p data-motion-reveal>Alongside my infrastructure background, I focus on developing cloud and DevOps capabilities, including AWS, Linux server deployment, Docker, and CI/CD workflows.</p>
              </>}
            </div>
            <div className={styles.highlights} data-motion-stagger>
              <Card className={styles.highlight} data-motion-reveal>
                <span className={styles.mark} aria-hidden="true">01 /</span>
                <h3 className={styles.title}>Professional foundation</h3>
                <p>Enterprise IT support, systems administration, and infrastructure operations.</p>
              </Card>
              <Card className={styles.highlight} data-motion-reveal>
                <span className={styles.mark} aria-hidden="true">02 /</span>
                <h3 className={styles.title}>Continued development</h3>
                <p>Cloud platforms, Linux deployment, containers, and CI/CD workflows.</p>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
