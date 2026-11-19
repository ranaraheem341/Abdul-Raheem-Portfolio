import Image from "next/image";
import { Badge, Button, Card } from "@/components/ui";
import { caseStudyFields, projectStatusLabels, type ProjectDefinition } from "./projects-data";
import styles from "./projects.module.css";
import { publicAsset, safePublicUrl, type PublicPortfolio, type PublicRow } from "@/lib/public-portfolio";

export function PublishedProjectCard({ project, media }: { project: PublicRow<"projects">; media: PublicPortfolio["media"] }) {
  const repository = safePublicUrl(project.source_url);
  const live = safePublicUrl(project.project_url);
  return <article aria-labelledby={`project-${project.id}-title`} className={styles.article} data-motion-reveal>
    <Card className={styles.card}>
      <h3 id={`project-${project.id}-title`} className={styles.title}>{project.title}</h3>
      <p className={styles.description}>{project.description}</p>
      <ul role="list" className={styles.tags} aria-label={`${project.title} technologies`}>
        {project.technologies.map((technology, index) => <li key={index}><Badge className={styles.badge}>{technology}</Badge></li>)}
      </ul>
      {media.filter((item) => item.purpose === "screenshot" && item.draft_project_id === project.id).map((item) => <figure key={item.id} className={styles.figure}>
        <div className={styles.imageFrame}><Image src={publicAsset(item.id)} alt={item.alt_text} width={1200} height={800} unoptimized className={styles.image} /></div>
      </figure>)}
      {(repository || live) && <div className={styles.actions}>
        {repository && <Button href={repository} variant="outline" className={styles.button}>View repository</Button>}
        {live && <Button href={live} variant="secondary" className={styles.button}>View project</Button>}
      </div>}
    </Card>
  </article>;
}

export function ProjectCard({ project }: { project: ProjectDefinition }) {
  if (project.verification !== "verified" || !project.evidenceReferences.some((reference) => reference.trim())) return null;

  const titleId = `project-${project.slug}-title`;
  const caseStudy = project.caseStudy;
  const availableFields = caseStudyFields.filter((field) => caseStudy?.[field.key]?.trim());

  return (
    <article aria-labelledby={titleId} className={styles.article} data-motion-reveal>
      <Card className={styles.card}>
        <div className={styles.badges}>
          <Badge variant="accent" className={styles.badge}>{project.category}</Badge>
          <Badge className={styles.badge}>Status: {projectStatusLabels[project.status]}</Badge>
          <Badge className={styles.badge}>Verified record</Badge>
        </div>
        <h3 id={titleId} className={styles.title}>{project.title}</h3>
        <p className={styles.description}>{project.description}</p>
        {project.technologies.length > 0 && (
          <ul role="list" className={styles.tags} aria-label={`${project.title} technologies`}>
            {project.technologies.map((technology) => <li key={technology}><Badge className={styles.badge}>{technology}</Badge></li>)}
          </ul>
        )}
        {project.screenshots?.map((screenshot) => (
          <figure key={screenshot.image.src} className={styles.figure}>
            <div className={styles.imageFrame}><Image src={screenshot.image} alt={screenshot.alt} className={styles.image}
              sizes="(min-width: 76rem) 520px, (min-width: 48rem) 45vw, 90vw" /></div>
            {screenshot.caption && <figcaption className={styles.caption}>{screenshot.caption}</figcaption>}
          </figure>
        ))}
        {availableFields.length > 0 && (
          <details className={styles.caseStudy}>
            <summary>Read case study<span className="sr-only">: {project.title}</span></summary>
            <dl className={styles.facts}>
              {availableFields.map(({ key, label }) => (
                <div key={key}><dt>{label}</dt><dd>{caseStudy?.[key]}</dd></div>
              ))}
            </dl>
          </details>
        )}
        {(project.repositoryUrl || project.liveDemoUrl) && (
          <div className={styles.actions}>
            {project.repositoryUrl && <Button href={project.repositoryUrl} variant="outline" className={styles.button} aria-label={`View repository: ${project.title}`}>View repository</Button>}
            {project.liveDemoUrl && <Button href={project.liveDemoUrl} variant="secondary" className={styles.button} aria-label={`View live demo: ${project.title}`}>View live demo</Button>}
          </div>
        )}
      </Card>
    </article>
  );
}
