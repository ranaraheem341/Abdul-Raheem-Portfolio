import { Container } from "@/components/ui";
import styles from "./skills-marquee.module.css";

const technologies = [
  "Windows Server", "Active Directory", "Group Policy", "Cisco", "MikroTik",
  "DNS/DHCP", "Microsoft 365", "Linux", "AWS", "Azure", "Docker",
  "GitHub Actions", "CI/CD", "Nginx", "Git",
];

export function SkillsMarquee() {
  return <Container>
    <aside className={styles.marquee} aria-label="Infrastructure, cloud and DevOps toolkit" data-motion-loop>
      <div className={styles.header}>
        <p className={styles.caption}>Across the stack</p>
      </div>
      <div className={styles.viewport} tabIndex={0} role="group" aria-label="Technology skills; focus to pause motion">
        <div className={styles.track}>
          <ul className={styles.group} aria-label="Technologies">
            {technologies.map(name => <li key={name}>{name}</li>)}
          </ul>
          <ul className={`${styles.group} ${styles.duplicate}`} aria-hidden="true">
            {technologies.map(name => <li key={name}>{name}</li>)}
          </ul>
        </div>
      </div>
    </aside>
  </Container>;
}
