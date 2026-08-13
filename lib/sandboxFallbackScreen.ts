export function buildSandboxFallbackScreen(): string {
  return `import React from "react";

function GeneratedScreen() {
  return (
    <main className="w-full min-h-[640px] bg-[var(--surface)] text-[var(--text-primary)] p-8 lg:p-12">
      <section className="w-full max-w-5xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 lg:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          Canvas preview
        </p>
        <h1 className="mt-3 text-2xl lg:text-4xl font-semibold tracking-tight">
          Layout placeholder
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          This frame is ready for another pass. Use regenerate to paint the screen with the locked design system.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-xl bg-[var(--surface-overlay)]" />
          <div className="h-28 rounded-xl bg-[var(--surface-overlay)]" />
        </div>
      </section>
    </main>
  );
}

export default GeneratedScreen;
`;
}

export function isProbablyCompleteScreen(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 40) return false;
  return (
    /(?:function|class|const|let|var)\s+GeneratedScreen\b/.test(trimmed) &&
    /export\s+default\b/.test(trimmed)
  );
}
