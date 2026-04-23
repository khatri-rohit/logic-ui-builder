"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type LandingNavProps = {
  ctaHref?: string;
};

export function LandingNav({ ctaHref = "/sign-up" }: LandingNavProps) {
  const [isNavHidden, setIsNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const navHiddenRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;
      const shouldHide = isScrollingDown && currentScrollY > 80;

      if (shouldHide !== navHiddenRef.current) {
        navHiddenRef.current = shouldHide;
        setIsNavHidden(shouldHide);
      }

      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 transition-transform duration-300 ease-out ${
        isNavHidden ? "-translate-y-[140%]" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between rounded-xl border border-(--logic-border-soft) bg-(--logic-surface-container-lowest)/90 px-3 shadow-[0_14px_36px_rgba(5,10,18,0.08)] backdrop-blur-xl sm:px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tight text-(--logic-on-surface) sm:text-xl">
            LOGIC
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-(--logic-secondary) md:inline">
            Interface Engine
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border-(--logic-border) bg-(--logic-surface-container-lowest) text-(--logic-on-surface) hover:bg-(--logic-surface-container-low)" />
          <Link
            href={ctaHref}
            className="inline-flex h-9 items-center rounded-md border border-transparent bg-(--logic-on-surface) px-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-(--logic-surface-container-lowest) transition-colors hover:bg-(--logic-primary-fixed) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--logic-on-surface) focus-visible:ring-offset-2 focus-visible:ring-offset-(--logic-surface-container-lowest)"
          >
            Try Now
          </Link>
        </div>
      </div>
    </nav>
  );
}
