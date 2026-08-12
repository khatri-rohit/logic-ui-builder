import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ClerkProviders from "@/providers/clerk";
import QueryProvider from "@/providers/tankstack-query";
import { UserActivityStoreProvider } from "@/providers/zustand-provider";
import { getSiteUrl } from "../lib/seo";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LOGIC | AI-Powered UI/UX Builder",
    template: "%s | LOGIC",
  },
  description:
    "Turn plain-language product ideas into production-ready UI and UX systems. LOGIC generates responsive interfaces and clean frontend code in minutes.",
  applicationName: "LOGIC",
  keywords: [
    "AI UI builder",
    "UI UX generator",
    "AI design tool",
    "responsive UI generation",
    "frontend code generation",
    "design to code",
  ],
  openGraph: {
    type: "website",
    siteName: "LOGIC",
    title: "LOGIC | AI-Powered UI/UX Builder",
    description:
      "Generate production-ready, responsive UI and UX systems from natural-language prompts.",
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
      "Generate production-ready, responsive UI and UX systems from natural-language prompts.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <UserActivityStoreProvider>
          <QueryProvider>
            <ClerkProviders>{children}</ClerkProviders>
          </QueryProvider>
        </UserActivityStoreProvider>
        {/* <Analytics />
        <SpeedInsights /> */}
      </body>
    </html>
  );
}
