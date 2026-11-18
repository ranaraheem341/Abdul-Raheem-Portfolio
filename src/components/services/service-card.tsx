import { Badge, Button, Card } from "@/components/ui";
import { ServiceIcon } from "./service-icon";
import { serviceDestination, type ServiceDefinition } from "./services-data";
import styles from "./services.module.css";

export function ServiceCard({ service }: { service: ServiceDefinition }) {
  const titleId = `service-${service.id}-title`;
  const destination = serviceDestination(service);

  return (
    <article aria-labelledby={titleId} className={styles.article}>
      <Card className={styles.card}>
        <div className={styles.topline}>
          <span className={styles.icon}><ServiceIcon name={service.icon} /></span>
          <Badge className={styles.category}>{service.category}</Badge>
        </div>
        <h3 id={titleId} className={styles.title}>{service.title}</h3>
        <p className={styles.description}>{service.description}</p>
        <ul className={styles.offerings} role="list" aria-label={`${service.title} deliverables`}>
          {service.offerings.map((offering) => (
            <li key={offering}><span aria-hidden="true" className={styles.check}>✓</span><span>{offering}</span></li>
          ))}
        </ul>
        <div className={styles.action}>
          {destination ? (
            <Button href={destination.href} variant="outline" className={styles.button}
              target={destination.href.startsWith("https://") ? "_blank" : undefined}
              rel="noopener noreferrer" aria-label={`${destination.label}: ${service.title}`}>
              {destination.label}<span aria-hidden="true">↗</span>
            </Button>
          ) : (
            <Button disabled variant="outline" className={styles.button} aria-label={`Discuss ${service.title}`} aria-describedby="services-contact-status">
              Discuss this service
            </Button>
          )}
        </div>
      </Card>
    </article>
  );
}
