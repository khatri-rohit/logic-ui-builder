import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Dashboard from "@/components/dashboard/Dashboard";
import LandingPage from "@/components/landing/LandingPage";
import { getSiteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "LOGIC | AI-Powered UI/UX Builder",
  description:
    "Build production-ready, responsive UI flows from natural language. LOGIC helps teams move from product idea to frontend implementation faster.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LOGIC | AI-Powered UI/UX Builder",
    description:
      "Build production-ready, responsive UI flows from natural language with LOGIC.",
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LOGIC AI UI/UX Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LOGIC | AI-Powered UI/UX Builder",
    description:
      "Build production-ready, responsive UI flows from natural language with LOGIC.",
    images: ["/og-image.png"],
  },
};

const landingStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LOGIC",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description:
      "LOGIC is an AI-powered UI/UX builder that generates responsive, production-ready interfaces from natural language prompts.",
    url: siteUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    creator: {
      "@type": "Organization",
      name: "LOGIC",
      url: siteUrl,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LOGIC",
    url: siteUrl,
  },
];

export default async function Home() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return (
      <>
        <LandingPage />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(landingStructuredData),
          }}
        />
      </>
    );
  }

  return <Dashboard />;
}
