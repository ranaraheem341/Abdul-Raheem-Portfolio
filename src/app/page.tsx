import { Hero } from "@/components/hero/hero";

import { About } from "@/components/about/about";
import type { Metadata } from "next";
import { personJsonLd, siteDescription, siteTitle, siteUrl } from "@/lib/seo";
import { Experience } from "@/components/experience/experience";
import { Skills } from "@/components/skills/skills";
import { Services } from "@/components/services/services";
import { Projects } from "@/components/projects/projects";
import { Credentials } from "@/components/credentials/credentials";
import { Contact } from "@/components/contact/contact";
import { getPublicPortfolio } from "@/lib/public-portfolio";

// Canonicals belong to individual pages; section fragments are not separate URLs.
const fallbackMetadata: Metadata = {
  ...(siteUrl ? { alternates: { canonical: siteUrl.href } } : {}),
  openGraph: {
    type: "website",
    locale: "en",
    siteName: "Abdul Raheem",
    title: siteTitle,
    description: siteDescription,
    ...(siteUrl ? { url: siteUrl.href } : {}),
  },
};

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const profile = (await getPublicPortfolio())?.profile;
  if (!profile) return fallbackMetadata;
  const title = profile.headline ? `${profile.full_name} | ${profile.headline}` : profile.full_name;
  const description = profile.professional_summary || profile.biography.slice(0, 300);
  return { ...fallbackMetadata, title: { absolute: title }, description,
    openGraph: { ...fallbackMetadata.openGraph, title, description, siteName: profile.full_name },
    twitter: { card: "summary", title, description } };
}

export default async function Home() {
  const content = await getPublicPortfolio();
  const person = content?.profile ? { ...personJsonLd, name: content.profile.full_name,
    jobTitle: content.profile.headline, description: content.profile.professional_summary } : personJsonLd;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(person).replace(/</g, "\\u003c"),
        }}
      />
      <div className="public-theme public-portfolio">
      <Hero content={content} />
      <Projects content={content} />
      <Skills records={content?.skills} />
      <Services />
      <About profile={content?.profile} />
      <Experience records={content?.experience} />
      <Credentials content={content} />
      <Contact links={content?.links} />
      </div>
    </>
  );
}
