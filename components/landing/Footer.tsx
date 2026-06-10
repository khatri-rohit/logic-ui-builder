import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-(--logic-border-soft) bg-(--logic-bg) px-6 py-8 md:flex-row">
      <div className="text-lg font-black uppercase tracking-tight text-black">
        LOGIC
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-(--logic-secondary)">
        <Link href="/privacy" className="hover:text-(--logic-on-surface)">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-(--logic-on-surface)">
          Terms
        </Link>
        <Link href="/cookies" className="hover:text-(--logic-on-surface)">
          Cookies
        </Link>
        <Link href="/refund-policy" className="hover:text-(--logic-on-surface)">
          Refunds
        </Link>
      </nav>
      <div className="mono text-xs uppercase tracking-widest text-(--logic-muted)">
        (c) 2026 LOGIC PRECISION INSTRUMENTS. ALL RIGHTS RESERVED.
      </div>
    </footer>
  );
}
