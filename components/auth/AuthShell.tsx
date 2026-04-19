"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Inter, Manrope } from "next/font/google";
import { Bot, ShieldCheck, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./auth-theme.module.css";

import { cn } from "@/lib/utils";

const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-logic-display",
  weight: ["400", "500", "700", "800"],
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-logic-body",
  weight: ["400", "500", "600", "700"],
});

type AuthMode = "sign-in" | "sign-up";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const systemStats = [
  // Decorative placeholder values; these are not real-time runtime metrics.
  { label: "Gateway latency", value: "14ms" },
  { label: "Session hardening", value: "Enabled" },
  { label: "Workspace region", value: "IAD-01" },
];

const navByMode: Record<AuthMode, { href: string; label: string }> = {
  "sign-in": { href: "/sign-up", label: "Create account" },
  "sign-up": { href: "/sign-in", label: "Already registered" },
};

const shellVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.2 },
  },
};

const leftPanelVariants = {
  hidden: { opacity: 0, x: -18 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.42,
      delay: 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    x: -12,
    transition: { duration: 0.2 },
  },
};

const rightPanelVariants = {
  hidden: { opacity: 0, x: 18 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.42,
      delay: 0.12,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    x: 12,
    transition: { duration: 0.2 },
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
        "relative min-h-screen overflow-hidden selection:bg-(--logic-primary-fixed) selection:text-white",
      )}
    >
      <div
        className={cn(styles.gridLayer, "pointer-events-none absolute inset-0")}
      />
      <div
        className={cn(styles.glowLayer, "pointer-events-none absolute inset-0")}
      />

      <header className="relative z-20 border-b border-[rgba(169,180,185,0.28)] bg-[rgba(247,249,251,0.82)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={cn(
                styles.displayText,
                "logic-auth-display text-[20px] font-black tracking-[0.24em] text-(--logic-on-surface)",
              )}
            >
              LOGIC
            </Link>
            <span
              className={cn(
                styles.labelText,
                "logic-auth-body text-[10px] font-semibold text-(--logic-secondary)",
              )}
            >
              AUTH NODE
            </span>
          </div>

          <Link
            href={secondaryNav.href}
            className={cn(
              styles.labelText,
              "logic-auth-body text-[10px] font-semibold text-(--logic-on-surface-variant) transition-colors hover:text-(--logic-primary-deep)",
            )}
          >
            {secondaryNav.label}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <motion.div
          className={cn(
            styles.shellSurface,
            "grid w-full overflow-hidden lg:grid-cols-[1.05fr_0.95fr]",
          )}
          variants={shellVariants}
          initial={initialState}
          animate="visible"
          exit="exit"
        >
          <motion.section
            className={cn(
              styles.leftPanelSurface,
              "relative border-b border-[rgba(169,180,185,0.3)] px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:border-r-[rgba(169,180,185,0.32)] lg:px-12 lg:py-14",
            )}
            variants={leftPanelVariants}
            initial={initialState}
            animate="visible"
            exit="exit"
          >
            <div
              className={cn(
                styles.accentChip,
                "inline-flex items-center gap-2 px-3 py-1.5",
              )}
            >
              <Sparkles className="size-3.5 text-(--logic-primary-fixed)" />
              <span
                className={cn(
                  styles.labelText,
                  "logic-auth-body text-[10px] font-semibold text-(--logic-secondary)",
                )}
              >
                Secure UI generation workspace
              </span>
            </div>

            <h1
              className={cn(
                styles.displayText,
                "logic-auth-display mt-5 text-3xl font-extrabold tracking-tight text-(--logic-on-surface) sm:mt-6 sm:text-5xl",
              )}
            >
              ENTER THE
              <br />
              <span className={styles.gradientText}>INTERFACE ENGINE</span>
            </h1>

            <p className="logic-auth-body mt-6 max-w-xl border-l border-[rgba(169,180,185,0.45)] pl-4 text-sm leading-relaxed text-(--logic-on-surface-variant) sm:text-base">
              Access your LOGIC workspace to generate production-grade UI flows,
              iterate visual systems, and ship structured design code with
              deterministic speed.
            </p>

            <div className="mt-7 hidden gap-3 sm:grid sm:grid-cols-3">
              {systemStats.map((item) => (
                <article
                  key={item.label}
                  className={cn(styles.statCard, "px-4 py-4")}
                >
                  <p
                    className={cn(
                      styles.labelText,
                      "logic-auth-body text-[9px] font-semibold text-(--logic-secondary)",
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="logic-auth-body mt-2 text-sm font-semibold text-(--logic-on-surface)">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div
              className={cn(
                styles.securityStrip,
                "mt-8 hidden items-center gap-3 px-4 py-4 sm:flex",
              )}
            >
              <div
                className={cn(
                  styles.iconBadge,
                  "flex size-9 items-center justify-center",
                )}
              >
                <ShieldCheck className="size-4 text-(--logic-primary-fixed)" />
              </div>
              <p
                className={cn(
                  "logic-auth-body text-[11px] tracking-[0.08em] text-(--logic-secondary)",
                )}
              >
                Session policies and model access are audited in real time.
              </p>
            </div>
          </motion.section>

          <motion.section
            className={cn(
              styles.rightPanelSurface,
              "px-6 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-14",
            )}
            variants={rightPanelVariants}
            initial={initialState}
            animate="visible"
            exit="exit"
          >
            <div className="mb-7 flex items-center justify-between border-b border-[rgba(169,180,185,0.34)] pb-4">
              <div>
                <p
                  className={cn(
                    styles.labelText,
                    "logic-auth-body text-[9px] font-semibold text-(--logic-secondary)",
                  )}
                >
                  {mode === "sign-in"
                    ? "Credential verification"
                    : "Account provisioning"}
                </p>
                <h2
                  className={cn(
                    styles.displayText,
                    "logic-auth-display mt-2 text-2xl font-extrabold tracking-tight text-(--logic-on-surface)",
                  )}
                >
                  {title}
                </h2>
                <p className="logic-auth-body mt-2 max-w-md text-sm text-(--logic-on-surface-variant)">
                  {subtitle}
                </p>
              </div>

              <div className={cn(styles.iconBadge, "hidden p-2 sm:flex")}>
                <Bot className="size-4 text-(--logic-primary-deep)" />
              </div>
            </div>

            {children}
          </motion.section>
        </motion.div>
      </main>

      <div
        className={cn(styles.canvasNoise, "pointer-events-none fixed inset-0")}
      />
    </div>
  );
}
