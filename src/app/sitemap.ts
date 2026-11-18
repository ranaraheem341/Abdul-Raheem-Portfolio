import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // No invented origin, fragment entries, API routes, or fabricated lastModified.
  return siteUrl ? [{ url: siteUrl.href }] : [];
}
