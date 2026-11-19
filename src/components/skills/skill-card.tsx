import { Badge, Card } from "@/components/ui";
import { SkillIcon } from "./skill-icon";
import type { SkillCategory } from "./skills-data";
import styles from "./skills.module.css";

export function SkillCard({ category }: { category: SkillCategory }) {
  const titleId = `skills-${category.id}-title`;

  return (
    <article aria-labelledby={titleId} className={styles.article} data-motion-reveal>
      <Card className={styles.card}>
        <span className={styles.icon}><SkillIcon name={category.icon} /></span>
        <h3 id={titleId} className={styles.title}>{category.title}</h3>
        <p className={styles.description}>{category.description}</p>
        <ul className={styles.badges} role="list" aria-label={`${category.title} skills`}>
          {category.skills.map((skill) => (
            <li key={skill}><Badge className={styles.badge}>{skill}</Badge></li>
          ))}
        </ul>
        {category.note && <p className={styles.note}>{category.note}</p>}
      </Card>
    </article>
  );
}
