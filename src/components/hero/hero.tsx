import Image from "next/image";
import { Manrope } from "next/font/google";
import { Badge, Button, Container } from "@/components/ui";
import { publicAsset, type PublicPortfolio } from "@/lib/public-portfolio";
import styles from "./hero.module.css";

const manrope = Manrope({ subsets: ["latin"], weight: "800", display: "swap" });

const professionalRoles = [
  "IT Infrastructure Specialist",
  "DevOps & Cloud Engineer",
  "Windows Server & Network Administrator",
  "Microsoft 365 & IT Support Specialist",
];

const specialties = [
  { title: "Cloud", detail: "AWS / Microsoft 365", path: "M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-2 5 5 0 0 0-1 10Z" },
  { title: "Infrastructure", detail: "Windows Server / AD", path: "M4 3h16v7H4zM4 14h16v7H4zM7 6h1m3 0h6M7 17h1m3 0h6" },
  { title: "DevOps", detail: "Docker / CI/CD", path: "M12 12c-3-7-10-6-10 0s7 7 10 0 10-6 10 0-7 7-10 0Z" },
  { title: "Networking", detail: "Cisco / MikroTik", path: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6" },
];

export function Hero({ content }: { content?: PublicPortfolio | null }) {
  const profile = content?.profile;
  const photo = content?.media.find(item => item.purpose === "photo");
  const cv = content?.media.find(item => item.purpose === "cv");
  const name = profile?.full_name || "Abdul Raheem";
  const [firstName, ...remainingNames] = name.trim().split(/\s+/);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("");
  const counts = content ? [
    { value: content.projects.length, label: "Published projects" },
    { value: content.skills.length, label: "Published skills" },
    { value: content.experience.length, label: "Experience records" },
    { value: content.certifications.length, label: "Published certifications" },
  ] : [];
  return <Container>
    <section id="home" tabIndex={-1} aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.ambient} aria-hidden="true" data-motion-loop />
      <div className={styles.copy}>
        <Badge variant="accent"><span className={styles.identityMark} aria-hidden="true" />{profile?.headline || "IT Executive & Infrastructure Professional"}</Badge>
        <h1 id="hero-title" className={`${manrope.className} ${styles.name}`}>{firstName}{remainingNames.length > 0 && <> <span className={styles.nameLast}>{remainingNames.join(" ")}</span></>}</h1>
        <p className={styles.headline} tabIndex={0}>
          <span className="sr-only">Professional roles: {professionalRoles.join("; ")}.</span>
          <span className={styles.roles} aria-hidden="true" data-motion-loop>
            {professionalRoles.map(role => <span key={role} className={styles.role}>{role}</span>)}
          </span>
        </p>
        <p className={styles.introduction}>{profile ? profile.professional_summary : "I help organizations maintain reliable IT infrastructure, secure enterprise networks, and efficient technology operations, with capabilities spanning Windows Server, Microsoft 365, cloud deployment, and DevOps tooling."}</p>
        <div className={styles.actions}>
          <Button href="/#projects" size="lg">View My Work <span aria-hidden="true">&rarr;</span></Button>
          {cv ? <Button href={publicAsset(cv.id)} download="Abdul-Raheem-CV.pdf" variant="secondary" size="lg">Download CV <span aria-hidden="true">&darr;</span></Button> : <Button href="/#experience" variant="secondary" size="lg">View Experience <span aria-hidden="true">&rarr;</span></Button>}
        </div>
      </div>
      <div className={styles.visual}>
        <div className={styles.portrait} data-motion-loop>
          {photo ? <div className={styles.portraitFrame}><Image src={publicAsset(photo.id)} alt={photo.alt_text} width={640} height={760} unoptimized className={styles.photo} /></div> : <div className={styles.placeholder}><span className={styles.monogram}>{initials}</span><span className={styles.portraitLabel}>{name}</span><span className={styles.portraitNote}>Infrastructure. Cloud. Possibility.</span></div>}
          <div className={styles.serverVisual} aria-hidden="true"><svg viewBox="0 0 160 130" fill="none"><path d="M38 53h77a18 18 0 0 0 0-36 29 29 0 0 0-55-1 19 19 0 0 0-22 37Z" fill="#edf8ff" stroke="#6acbff" strokeWidth="2" /><path d="M80 53v18m-35 0h70" stroke="#16a7ee" strokeWidth="2" />{[75, 93, 111].map(y => <g key={y}><rect x="30" y={y} width="100" height="14" rx="4" fill="#e9f4ff" stroke="#80bce9" /><path d={`M40 ${y+7}h46`} stroke="#488fc5" /><circle cx="117" cy={y+7} r="2" fill="#009af0" /></g>)}</svg></div>
        </div>
        <ul className={styles.specialties} aria-label="Professional focus areas">
          {specialties.map(item => <li key={item.title} className={styles.specialty}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
            <div><strong>{item.title}</strong><span>{item.detail}</span></div>
          </li>)}
        </ul>
      </div>
    </section>
    <aside className={styles.statistics} aria-label="Portfolio overview" data-motion-reveal>
      {counts.length ? <dl className={styles.counts}>{counts.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value.toLocaleString("en")}</dd></div>)}</dl> : <div className={styles.principles}>{["Reliable IT", "Scalable cloud", "Practical DevOps"].map((item, index) => <p key={item}><span aria-hidden="true">0{index + 1}</span>{item}</p>)}</div>}
      <p className={styles.statement}>Thoughtful systems.<br />Reliable operations.</p>
    </aside>
  </Container>;
}
