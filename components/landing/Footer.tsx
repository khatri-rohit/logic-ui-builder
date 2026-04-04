export function LandingFooter() {
  return (
    <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-[color:var(--logic-border-soft)] bg-[var(--logic-bg)] px-6 py-8 md:flex-row">
      <div className="text-lg font-black uppercase tracking-tight text-black">
        LOGIC
      </div>
      <div className="mono text-xs uppercase tracking-widest text-[var(--logic-muted)]">
        (c) 2026 LOGIC PRECISION INSTRUMENTS. ALL RIGHTS RESERVED.
      </div>
    </footer>
  );
}
