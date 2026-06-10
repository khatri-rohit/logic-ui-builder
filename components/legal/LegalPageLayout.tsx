import Link from "next/link";
import { Inter, Manrope } from "next/font/google";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-logic-display",
  weight: ["400", "500", "700", "800"],
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-logic-body",
  weight: ["400", "500", "600", "700"],
});

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-background text-foreground`}
    >
      <header className="w-full border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="text-xl font-black tracking-tighter text-foreground transition-opacity hover:opacity-80"
          >
            LOGIC
          </Link>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookies
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-foreground"
            >
              Refunds
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <h1 className="logic-body mb-3 text-4xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="logic-body text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <article className="logic-body prose prose-lg max-w-none text-foreground">
          {children}
        </article>
      </main>

      <footer className="w-full border-t border-border bg-background py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="text-lg font-black uppercase tracking-tight text-foreground">
            LOGIC
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookie Policy
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-foreground"
            >
              Refund Policy
            </Link>
          </div>
          <div className="mono text-xs uppercase tracking-widest text-muted-foreground/60">
            &copy; 2026 LOGIC. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
