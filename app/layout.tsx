import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ClerkProviders from "@/providers/clerk";
import QueryProvider from "@/providers/tankstack-query";
import { UserActivityStoreProvider } from "@/providers/zustand-provider";

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

export const metadata: Metadata = {
  title: "LOGIC - AI-Powered UI/UX Builder",
  description:
    "LOGIC is an AI-powered UI/UX builder that transforms your ideas into stunning designs. With LOGIC, you can effortlessly create beautiful and functional user interfaces for web and mobile applications. Whether you're a designer, developer, or product manager, LOGIC empowers you to bring your vision to life with ease and efficiency.",
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
