import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="grid w-full grid-cols-1 items-center gap-4 border-t border-(--logic-border) bg-(--logic-surface) px-6 py-8 md:grid-cols-3">
      <div className="logic-display text-center text-lg uppercase tracking-tight text-(--logic-on-surface) md:text-left">
        LOGIC
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-(--logic-secondary)">
        <Link
          href="/privacy"
          className="transition-colors hover:text-(--logic-on-surface) hover:underline hover:decoration-(--logic-accent) hover:underline-offset-4"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="transition-colors hover:text-(--logic-on-surface) hover:underline hover:decoration-(--logic-accent) hover:underline-offset-4"
        >
          Terms
        </Link>
        <Link
          href="/cookies"
          className="transition-colors hover:text-(--logic-on-surface) hover:underline hover:decoration-(--logic-accent) hover:underline-offset-4"
        >
          Cookies
        </Link>
        <Link
          href="/refund-policy"
          className="transition-colors hover:text-(--logic-on-surface) hover:underline hover:decoration-(--logic-accent) hover:underline-offset-4"
        >
          Refunds
        </Link>
      </nav>
      <div className="logic-mono text-center text-xs uppercase tracking-widest text-(--logic-muted) md:text-right">
        © 2026 LOGIC. All rights reserved.
      </div>
    </footer>
  );
}
