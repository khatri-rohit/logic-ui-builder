import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a] px-6 py-8 md:flex-row">
      <div className="logic-display text-lg uppercase tracking-tight text-white">
        LOGIC
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/70">
        <Link
          href="/privacy"
          className="transition-colors hover:text-white hover:underline hover:underline-offset-4 hover:decoration-[#ff6d00]"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="transition-colors hover:text-white hover:underline hover:underline-offset-4 hover:decoration-[#ff6d00]"
        >
          Terms
        </Link>
        <Link
          href="/cookies"
          className="transition-colors hover:text-white hover:underline hover:underline-offset-4 hover:decoration-[#ff6d00]"
        >
          Cookies
        </Link>
        <Link
          href="/refund-policy"
          className="transition-colors hover:text-white hover:underline hover:underline-offset-4 hover:decoration-[#ff6d00]"
        >
          Refunds
        </Link>
      </nav>
      <div className="logic-mono text-xs uppercase tracking-widest text-[#6b6b6b]">
        (c) 2026 LOGIC. All rights reserved.
      </div>
    </footer>
  );
}
