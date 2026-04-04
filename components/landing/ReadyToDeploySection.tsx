import Link from "next/link";

export function ReadyToDeploySection() {
  return (
    <section className="scroll-item relative flex min-h-[38rem] flex-col items-center justify-center bg-white p-12">
      <div className="space-y-6 text-center">
        <h2 className="text-[clamp(2.5rem,8vw,5rem)] font-black tracking-tighter">
          READY TO DEPLOY?
        </h2>
        <p className="mono text-base text-[var(--logic-muted)]">
          INITIALIZE_SESSION_REQUESTED
        </p>

        <div className="mx-auto mt-12 w-full max-w-2xl space-y-4">
          <div className="group border-2 border-black bg-black p-8 text-white transition-all duration-300 hover:bg-white hover:text-black">
            <div className="text-3xl font-black uppercase tracking-tighter">
              Start Building for Free
            </div>
            <div className="line-sweep mt-4 h-px bg-white/40 group-hover:bg-black/40" />

            <form
              action="/studio"
              method="get"
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <input
                className="mono min-h-11 w-full border-0 border-b border-current bg-transparent text-base uppercase outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="ENTER WORK EMAIL"
                type="email"
                name="email"
                required
                autoComplete="email"
                aria-label="Work email"
              />
              <button
                type="submit"
                className="min-h-11 bg-black px-8 py-2 text-sm font-bold text-white transition-all hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                JOIN
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/studio?auth=google"
              className="mono inline-flex min-h-11 items-center justify-center gap-2 border border-[color:var(--logic-border)] p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              GOOGLE_AUTH
            </Link>
            <Link
              href="/studio?auth=github"
              className="mono inline-flex min-h-11 items-center justify-center gap-2 border border-[color:var(--logic-border)] p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              GITHUB_AUTH
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
