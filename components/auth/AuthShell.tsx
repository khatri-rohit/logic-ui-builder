"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DM_Sans, JetBrains_Mono, Staatliches } from "next/font/google";
import { motion, useReducedMotion } from "motion/react";
import styles from "./auth-theme.module.css";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const displayFont = Staatliches({
  subsets: ["latin"],
  variable: "--font-logic-display",
  weight: ["400"],
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-logic-body",
  weight: ["400", "500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-logic-mono",
  weight: ["400", "500", "700"],
});

type AuthMode = "sign-in" | "sign-up";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const navByMode: Record<AuthMode, { href: string; label: string }> = {
  "sign-in": { href: "/sign-up", label: "Create account" },
  "sign-up": { href: "/sign-in", label: "Sign in" },
};

const shellVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: AuthShellProps) {
  const secondaryNav = navByMode[mode];
  const shouldReduceMotion = useReducedMotion();
  const initialState = shouldReduceMotion ? "visible" : "hidden";

  return (
    <div
      className={cn(
        styles.authRoot,
        displayFont.variable,
        bodyFont.variable,
        monoFont.variable,
        "relative min-h-screen overflow-hidden selection:bg-(--logic-accent) selection:text-white",
      )}
    >
      <div
        className={cn(styles.heroGrid, "pointer-events-none absolute inset-0")}
        aria-hidden
      />
      <div className={styles.decorativeLine} aria-hidden />

      <header className="relative z-20 border-b border-(--logic-border) bg-(--logic-surface)/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="logic-display text-lg uppercase tracking-tight text-(--logic-on-surface)">
              LOGIC
            </span>
            <span className="logic-mono hidden text-[10px] font-medium uppercase tracking-[0.18em] text-(--logic-secondary) sm:inline">
              Interface Engine
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle className="border-(--logic-border) bg-transparent text-(--logic-secondary) hover:bg-(--logic-surface-container) hover:text-(--logic-on-surface)" />
            <Link
              href={secondaryNav.href}
              className="logic-body inline-flex h-9 items-center bg-(--logic-on-surface) px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-(--logic-surface-container-lowest) transition-colors hover:bg-(--logic-accent) hover:text-white"
            >
              {secondaryNav.label}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-10">
        <motion.div
          className={cn(
            styles.shellSurface,
            "grid w-full overflow-hidden lg:grid-cols-[1.05fr_0.95fr]",
          )}
          variants={shellVariants}
          initial={initialState}
          animate="visible"
        >
          <section
            className={cn(
              styles.leftPanelSurface,
              "relative border-b border-(--logic-border) px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14",
            )}
          >
            <p className="logic-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--logic-accent)">
              {mode === "sign-in" ? "Welcome back" : "Get started"}
            </p>

            <h1
              className={cn(
                styles.displayText,
                "logic-display mt-4 text-[clamp(2.5rem,6vw,4.5rem)] text-(--logic-on-surface)",
              )}
            >
              TURN IDEAS
              <br />
              <span className={styles.accentText}>INTO UI</span>
            </h1>

            <div
              className="mt-4 h-1.5 w-24 bg-(--logic-accent)"
              aria-hidden
            />

            <p className="logic-body mt-6 max-w-md text-base leading-relaxed text-(--logic-secondary)">
              Describe your vision and generate modular, responsive components
              ready for your codebase.
            </p>
          </section>

          <section
            className={cn(
              styles.rightPanelSurface,
              "px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-14",
            )}
          >
            <div className="mb-7 border-b border-(--logic-border) pb-5">
              <h2
                className={cn(
                  styles.displayText,
                  "logic-display text-3xl text-(--logic-on-surface)",
                )}
              >
                {title}
              </h2>
              <p className="logic-body mt-2 max-w-md text-sm text-(--logic-secondary)">
                {subtitle}
              </p>
            </div>

            {children}
          </section>
        </motion.div>
      </main>

      <div
        className={cn(styles.canvasNoise, "pointer-events-none fixed inset-0")}
        aria-hidden
      />
    </div>
  );
}
