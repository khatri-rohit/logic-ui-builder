import Link from "next/link";

type LandingHeaderProps = {
  ctaHref?: string;
};

export function LandingHeader({ ctaHref = "/sign-up" }: LandingHeaderProps) {
  return (
    <nav className="logic-nav fixed left-0 top-0 z-50 flex w-full max-w-full items-center justify-between border-b border-(--logic-border-soft) bg-(--logic-bg) px-6 py-4">
      <div className="text-2xl font-black uppercase tracking-tighter text-black">
        LOGIC
      </div>
      <Link
        href={ctaHref}
        className="inline-flex min-h-11 items-center border border-black bg-black px-5 py-2 text-sm font-bold text-white transition-all duration-100 ease-in-out hover:bg-white hover:text-black active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-(--logic-bg)"
      >
        Try Now
      </Link>
    </nav>
  );
}
