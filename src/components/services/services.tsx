import { Button, Container, SectionHeading } from "@/components/ui";
import { ServiceCard } from "./service-card";
import { emailHref, fiverrProfileHref, services } from "./services-data";
import styles from "./services.module.css";

export function Services() {
  const contactHref = fiverrProfileHref ?? emailHref;

  return (
    <section id="services" tabIndex={-1} aria-labelledby="services-title" className={styles.section}>
      <Container>
        <SectionHeading eyebrow="WHAT I OFFER" title="Professional IT & Cloud Services" headingId="services-title"
          description="Practical IT infrastructure, cloud deployment, and automation services designed to help businesses build, maintain, and troubleshoot their technology environments." />
        <div className={styles.grid} data-motion-stagger>
          {services.map((service) => <ServiceCard key={service.id} service={service} />)}
        </div>
        <div className={styles.closing}>
          <p>Need help with your infrastructure or deployment project? Explore my services and get in touch.</p>
          {contactHref && (
            <Button href={contactHref} target={contactHref.startsWith("https://") ? "_blank" : undefined} rel="noopener noreferrer" className={styles.button}>
              {fiverrProfileHref ? "Explore on Fiverr" : "Get in touch"}
            </Button>
          )}
          {services.some((service) => !service.gigUrl) && !contactHref && (
            <p id="services-contact-status" className={styles.status}>Contact links will be added once verified. Service enquiries are not yet available through this portfolio.</p>
          )}
        </div>
      </Container>
    </section>
  );
}
