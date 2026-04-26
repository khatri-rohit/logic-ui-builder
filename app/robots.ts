import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: [
        "/api/",
        "/projects/",
        "/sign-in/",
        "/sign-up/",
        "/forgot-password/",
        "/billing/",
        "/org/",
        "/dashboard/",
      ],
    },
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl,
  };
}
