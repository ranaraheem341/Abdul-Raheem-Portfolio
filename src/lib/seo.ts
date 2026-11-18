/** Public production origin, supplied at build time. Never infer it from requests. */
function getSiteUrl(): URL | undefined {
  const value = process.env.SITE_URL?.trim();
  if (!value) return undefined;

  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    url.hostname === "localhost" || url.hostname.endsWith(".localhost")
  ) {
    throw new Error("SITE_URL must be the public HTTPS production origin, without credentials, path, query, or fragment.");
  }
  return url;
}

export const siteUrl = getSiteUrl();
export const siteTitle = "Abdul Raheem | IT Infrastructure, Cloud & DevOps";
export const siteDescription =
  "Professional portfolio of Abdul Raheem, showcasing IT infrastructure, Windows Server, enterprise networking, Microsoft 365, cloud technologies, and DevOps services.";

// Only professional facts already supplied in the visible Hero/About copy.
export const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Abdul Raheem",
  jobTitle: "IT Executive & Infrastructure Professional",
  description:
    "IT infrastructure professional with experience in enterprise IT support, Windows Server administration, networking, Microsoft 365, and infrastructure operations.",
  ...(siteUrl ? { "@id": `${siteUrl.href}#person`, url: siteUrl.href } : {}),
};
