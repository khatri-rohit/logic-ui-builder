"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type LandingHeaderProps = {
  ctaHref?: string;
};

export function Header({ ctaHref = "/sign-up" }: LandingHeaderProps) {
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
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
        isNavHidden ? "-translate-y-[120%]" : "translate-y-0"
      }`}
    >
      <div className="flex h-14 w-full items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="logic-display text-lg uppercase tracking-tight text-white">
            LOGIC
          </span>
          <span className="logic-mono hidden text-[10px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b] md:inline">
            Interface Engine
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border-[rgba(255,255,255,0.15)] bg-transparent text-white/70 hover:bg-white/10 hover:text-white" />
          <Link
            href={ctaHref}
            className="logic-body inline-flex h-9 items-center bg-white px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-colors hover:bg-[#ff6d00] hover:text-white"
          >
            Try Now
          </Link>
        </div>
      </div>
    </header>
  );
}
