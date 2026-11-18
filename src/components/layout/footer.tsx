import { Container } from "@/components/ui/container";
import { Brand } from "./brand";
import { NavigationItems } from "./navigation-items";
import { contactLinks, expertise } from "./navigation-config";
import { getPublicPortfolio } from "@/lib/public-portfolio";

export async function Footer() {
  const content = await getPublicPortfolio();
  const links = (content?.links ?? contactLinks).filter((contact) => contact.href);
  const year = new Date().getFullYear();

  return (
    <footer className="public-theme public-footer border-t border-border bg-background-secondary">
      <Container>
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 py-14 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.8fr)] xl:py-16">
          <div className="min-w-0">
            <Brand />
            <p className="mt-6 text-sm font-medium">{content?.profile ? content.profile.headline : "IT Infrastructure | Cloud & DevOps"}</p>
            <p className="mt-3 max-w-xs text-sm leading-7 text-muted">A professional portfolio focused on IT infrastructure, enterprise networking, Microsoft 365, cloud technologies, and DevOps.</p>
            <p className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-highlight" aria-hidden="true" />Infrastructure / Cloud / DevOps</p>
          </div>
          <nav aria-labelledby="footer-links-title" className="min-w-0">
            <h2 id="footer-links-title" className="footer-heading">Quick links</h2>
            <ul className="footer-navigation mt-4"><NavigationItems /></ul>

          </nav>
          <div className="min-w-0">
            <h2 className="footer-heading">Professional expertise</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted">{expertise.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="min-w-0">
            <h2 className="footer-heading">Connect</h2>
            <ul className="mt-4">
              {links.map((contact) => (
                <li key={contact.label}>
                  <a href={contact.href!} className="site-nav-link justify-between">{contact.label}<span aria-hidden="true">↗</span></a>
                </li>
              ))}
            </ul>
            {!links.length && <p className="mt-3 text-xs text-muted">Contact links will be added soon.</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-xs text-muted">
          <p>© {year} Abdul Raheem. All rights reserved.</p>
          <p className="font-mono text-[10px]">Thoughtful systems. Considered details.</p>
        </div>
      </Container>
    </footer>
  );
}
