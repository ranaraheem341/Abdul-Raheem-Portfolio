import { Container } from "@/components/ui/container";
import { Brand } from "./brand";
import { Button } from "@/components/ui";
import { getPublicPortfolio, publicAsset } from "@/lib/public-portfolio";
import { Navigation } from "./navigation";

export async function Header() {
  const cv = (await getPublicPortfolio())?.media.find(item => item.purpose === "cv");
  return (
    <header className="site-header public-theme">
      <Container className="site-header-inner">
        <Brand />
        <Navigation />
        <div className="header-cv">{cv ? <Button href={publicAsset(cv.id)} download="Abdul-Raheem-CV.pdf" variant="secondary" size="sm">Download CV <span aria-hidden="true">&darr;</span></Button> : <Button href="/#credentials" variant="secondary" size="sm">Resume <span aria-hidden="true">&#8599;</span></Button>}</div>
      </Container>
    </header>
  );
}
