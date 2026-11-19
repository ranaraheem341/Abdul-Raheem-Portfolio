import { Badge, Button, Card } from "@/components/ui";
import { isPublishable, type CertificationDefinition } from "./credentials-data";
import styles from "./credentials.module.css";
import { publicDate, safePublicUrl, type PublicRow } from "@/lib/public-portfolio";

export function PublishedCertificationCard({ certification }: { certification: PublicRow<"certifications"> }) {
  const href = safePublicUrl(certification.credential_url);
  return <article data-motion-reveal><Card className={styles.record}>
    <h4 className={styles.recordTitle}>{certification.name}</h4><p>{certification.issuer}</p>
    <dl className={styles.facts}>
      {certification.issued_on && <div><dt>Issued</dt><dd>{publicDate(certification.issued_on)}</dd></div>}
      {certification.expires_on && <div><dt>Expires</dt><dd>{publicDate(certification.expires_on)}</dd></div>}
    </dl>
    {href && <Button href={href} variant="outline" size="sm" className={styles.action} aria-label={`Verify credential: ${certification.name}`}>Verify credential</Button>}
  </Card></article>;
}

export function CertificationCard({ certification }: { certification: CertificationDefinition }) {
  if (!isPublishable(certification)) return null;
  const completed = certification.status === "completed";

  return (
    <article data-motion-reveal>
      <Card className={styles.record}>
        <Badge className={styles.badge} variant={completed ? "accent" : "default"}>
          {completed ? "Completed" : "In progress — not yet certified"}
        </Badge>
        <h4 className={styles.recordTitle}>{certification.name}</h4>
        <p>{certification.issuer}</p>
        {completed && (
          <>
            <dl className={styles.facts}>
              {certification.issueDate && <div><dt>Issued</dt><dd>{certification.issueDate}</dd></div>}
              {certification.expirationDate && <div><dt>Expires</dt><dd>{certification.expirationDate}</dd></div>}
              {certification.credentialId && <div><dt>Credential ID</dt><dd>{certification.credentialId}</dd></div>}
            </dl>
            {certification.credentialUrl && (
              <Button href={certification.credentialUrl} variant="outline" size="sm" className={styles.action} aria-label={`Verify credential: ${certification.name}`}>
                Verify credential
              </Button>
            )}
          </>
        )}
      </Card>
    </article>
  );
}
