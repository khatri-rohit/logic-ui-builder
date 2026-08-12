"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LandingProgressBar } from "./LandingProgressBar";

const NAV_LINKS = [
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
] as const;

type LandingHeaderProps = {
  ctaHref?: string;
};

export function Header({ ctaHref = "/sign-up" }: LandingHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex h-14 w-full items-center gap-4 border-b border-(--logic-border) bg-(--logic-surface)/90 px-6 backdrop-blur-md">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="logic-display text-lg uppercase tracking-tight text-(--logic-on-surface)">
            LOGIC
          </span>
          <span className="logic-mono hidden text-[10px] font-medium uppercase tracking-[0.18em] text-(--logic-secondary) md:inline">
            Interface Engine
          </span>
        </Link>

        <nav
          className="ml-auto hidden items-center gap-6 sm:flex"
          aria-label="Landing"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="logic-mono text-[10px] font-medium uppercase tracking-[0.14em] text-(--logic-secondary) transition-colors hover:text-(--logic-on-surface)"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:ml-4">
          <ThemeToggle className="border-(--logic-border) bg-transparent text-(--logic-secondary) hover:bg-(--logic-surface-container) hover:text-(--logic-on-surface)" />
          <Link
            href={ctaHref}
            className="logic-body inline-flex h-9 items-center bg-(--logic-on-surface) px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-(--logic-surface-container-lowest) transition-colors hover:bg-(--logic-accent) hover:text-white"
          >
            Try Now
          </Link>
        </div>
      </div>
      <LandingProgressBar />
    </header>
  );
}
