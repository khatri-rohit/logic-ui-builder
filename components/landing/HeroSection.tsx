"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, PlayCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { heroVisualRevealAnimation, revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";
import { VideoModal } from "./VideoModal";
import { useState } from "react";

export function HeroSection() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion() ?? false;

  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);
  const heroVisualReveal = heroVisualRevealAnimation(shouldReduceMotion);

  const startOnboarding = () => {
    router.push("/sign-up");
  };

  return (
    <motion.section
      className="relative mx-auto flex min-h-screen w-full flex-col items-center overflow-hidden px-8 pt-24 lg:flex-row lg:px-16 xl:px-24"
      {...reveal()}
    >
      <VideoModal
        open={open}
        onOpenChange={setOpen}
        videoUrl="/Logic_ui-builder-final.mp4"
      />

      {/* Geometric grid background */}
      <div className={`${styles.heroGrid} pointer-events-none absolute inset-0 hero-grid-layer`} />

      {/* Left: Editorial headline */}
      <motion.div
        className="z-10 flex w-full flex-col justify-center pt-12 lg:w-3/5 lg:pt-0"
        {...reveal(0.08)}
      >
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-(--logic-secondary)">
          <span className="inline-block h-3 w-3 bg-(--logic-accent)" />
          <span className="logic-mono">v2.0 — Precision Interface Engine</span>
        </div>

        <h1
          className={`${styles.displayText} logic-display mt-6 text-[clamp(3.5rem,10vw,8rem)] font-black leading-[1.05] text-(--logic-on-surface)`}
        >
          TURN IDEAS
          <br />
          <span className={styles.accentText}>INTO UI</span>
          <br />
          INSTANTLY.
        </h1>

        {/* Animated orange underline */}
        <div className="line-sweep mt-2 h-[8px] w-full max-w-[400px] bg-(--logic-accent)" />

        <p className="logic-body mt-8 max-w-lg text-lg leading-relaxed text-(--logic-secondary)">
          Skip the boilerplate. Describe your vision, and our engine generates
          modular, responsive components ready for your codebase.
        </p>

        <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={startOnboarding}
            className={`${styles.btnPrimary} logic-body inline-flex items-center gap-2 px-8 py-6 text-base font-semibold`}
          >
            <span>Build your first UI free</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="logic-body inline-flex cursor-pointer items-center gap-2 bg-transparent font-medium text-(--logic-secondary) transition-colors duration-200 hover:bg-transparent hover:text-(--logic-on-surface)"
          >
            <PlayCircle className="h-5 w-5" aria-hidden />
            <span>Watch Demo</span>
          </Button>
        </div>
      </motion.div>

      {/* Right: Editorial mockup */}
      <motion.div
        className="relative mt-16 w-full overflow-hidden lg:mt-0 lg:w-2/5 lg:pl-12"
        {...heroVisualReveal}
      >
        <div className="relative flex aspect-[4/5] w-full flex-col border border-(--logic-border) bg-(--logic-surface-container-low)">
          {/* Editorial composition header */}
          <div className="flex items-center justify-between border-b border-(--logic-border-soft) px-5 py-3">
            <span className="logic-mono text-[10px] uppercase tracking-widest text-(--logic-secondary)">
              Preview
            </span>
            <span className="logic-mono text-[10px] text-(--logic-accent)">
              v2.0.1
            </span>
          </div>

          {/* Abstract editorial layout */}
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex gap-4">
              <div className="h-16 w-16 bg-(--logic-accent)" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 bg-(--logic-on-surface)" />
                <div className="h-3 w-1/2 bg-(--logic-border)" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="aspect-square bg-(--logic-border)" />
              <div className="aspect-square bg-(--logic-on-surface)" />
              <div className="aspect-square bg-(--logic-accent-muted)" />
            </div>

            <div className="mt-auto space-y-2">
              <div className="h-2 w-full bg-(--logic-border)" />
              <div className="h-2 w-3/4 bg-(--logic-border-soft)" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 flex-1 border border-(--logic-border)" />
                <div className="h-6 w-16 bg-(--logic-accent)" />
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-(--logic-border-soft) px-5 py-2">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-(--logic-accent)" />
              <div className="h-2 w-2 rounded-full bg-(--logic-border)" />
              <div className="h-2 w-2 rounded-full bg-(--logic-border)" />
            </div>
            <span className="logic-mono text-[9px] uppercase tracking-widest text-(--logic-secondary)">
              Editorial
            </span>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
