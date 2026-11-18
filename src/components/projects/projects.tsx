import { Card, Container, SectionHeading } from "@/components/ui";
import { ProjectCard } from "./project-card";
import { verifiedProjects } from "./projects-data";
import styles from "./projects.module.css";
import { PublishedProjectCard } from "./project-card";
import type { PublicPortfolio } from "@/lib/public-portfolio";

export function Projects({ content }: { content?: PublicPortfolio | null }) {
  const hasProjects = content ? content.projects.length > 0 : verifiedProjects.length > 0;
  return (
    <section id="projects" tabIndex={-1} aria-labelledby="projects-title" className={styles.section}>
      <Container>
        <SectionHeading
          eyebrow="PROJECTS & CASE STUDIES"
          title="Featured Projects"
          headingId="projects-title"
          description="Technical work, implementation decisions, and documented evidence."
        />
        {hasProjects ? (
          <div className={styles.grid}>
            {content ? content.projects.map((project) => <PublishedProjectCard key={project.id} project={project} media={content.media} />) : verifiedProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}
          </div>
        ) : (
          <Card className={styles.empty}>
            <span className={styles.icon} aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" focusable="false">
                <path d="M4 7.5h6l2-3h8v15H4z" strokeLinejoin="round" />
                <path d="m10 11-2 2 2 2m4-4 2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className={styles.emptyTitle}>A space for documented technical work</h3>
            <p className={styles.emptyDescription}>Selected technical projects and documented case studies will be published here as they become available.</p>
          </Card>
        )}
      </Container>
    </section>
  );
}
