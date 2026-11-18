import { Container, SectionHeading } from "@/components/ui";
import { SkillCard } from "./skill-card";
import { skillCategories } from "./skills-data";
import styles from "./skills.module.css";
import type { PublicRow } from "@/lib/public-portfolio";
import type { SkillCategory } from "./skills-data";

export function Skills({ records }: { records?: PublicRow<"skills">[] }) {
  const groups: SkillCategory[] = [];
  for (const row of records ?? []) {
    const existing = groups.find((group) => group.title === row.category);
    if (existing) groups[groups.indexOf(existing)] = { ...existing, skills: [...existing.skills, row.name] };
    else groups.push({ id: row.id, title: row.category, icon: "tools", description: "", skills: [row.name] });
  }
  const categories = records ? groups : skillCategories;
  const stack = [...new Set(categories.flatMap(category => category.skills))];
  return (
    <section id="skills" tabIndex={-1} aria-labelledby="skills-title" className={styles.section}>
      <Container>
        <SectionHeading
          eyebrow="Technical toolkit"
          title="Technical Skills & Expertise"
          headingId="skills-title"
          description="A foundation in IT infrastructure, networking, and technical support, alongside continued development in cloud and DevOps."
        />
        {stack.length > 0 && <aside className={styles.stack} aria-labelledby="stack-title">
          <h3 id="stack-title" className={styles.stackTitle}>Technology Stack</h3>
          <ul className={styles.stackGrid}>{stack.map((name, index) => <li key={name}><span aria-hidden="true" className={styles.stackMark}>{String(index + 1).padStart(2, "0")}</span><span>{name}</span></li>)}</ul>
        </aside>}
        {categories.length === 0 && <p className={styles.note}>Published technical skills will appear here when available.</p>}
        <div className={styles.grid}>
          {categories.map((category) => <SkillCard key={category.id} category={category} />)}
        </div>
      </Container>
    </section>
  );
}
