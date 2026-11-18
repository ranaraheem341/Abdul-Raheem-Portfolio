import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteLayout } from "@/components/layout/site-layout";
import { siteDescription, siteTitle, siteUrl } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl ?? null,
  title: { default: siteTitle, template: "%s | Abdul Raheem" },
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "en",
    siteName: "Abdul Raheem",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  robots: { index: Boolean(siteUrl), follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
