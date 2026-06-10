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
      className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-(--logic-bg) text-(--logic-on-surface)`}
    >
      <header className="w-full border-b border-(--logic-border-soft) bg-(--logic-bg)">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="text-xl font-black tracking-tighter text-(--logic-on-surface) transition-opacity hover:opacity-80"
          >
            LOGIC
          </Link>
          <nav className="flex gap-6 text-sm text-(--logic-secondary)">
            <Link href="/privacy" className="hover:text-(--logic-on-surface)">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-(--logic-on-surface)">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-(--logic-on-surface)">
              Cookies
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-(--logic-on-surface)"
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
          <p className="logic-body text-sm text-(--logic-secondary)">
            Last updated: {lastUpdated}
          </p>
        </div>

        <article className="logic-body prose prose-lg max-w-none text-(--logic-on-surface)">
          {children}
        </article>
      </main>

      <footer className="w-full border-t border-(--logic-border-soft) bg-(--logic-bg) py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="text-lg font-black uppercase tracking-tight text-(--logic-on-surface)">
            LOGIC
          </div>
          <div className="flex gap-6 text-sm text-(--logic-secondary)">
            <Link href="/privacy" className="hover:text-(--logic-on-surface)">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-(--logic-on-surface)">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-(--logic-on-surface)">
              Cookie Policy
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-(--logic-on-surface)"
            >
              Refund Policy
            </Link>
          </div>
          <div className="mono text-xs uppercase tracking-widest text-(--logic-muted)">
            &copy; 2026 LOGIC. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
