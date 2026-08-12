"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { heroVisualRevealAnimation, revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";
import { VideoModal } from "./VideoModal";

export function HeroSection() {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);
  const heroVisualReveal = heroVisualRevealAnimation(shouldReduceMotion);

  return (
    <motion.section
      className="relative mx-auto flex min-h-[calc(100svh-56px)] w-full flex-col items-center overflow-hidden px-8 pt-16 lg:flex-row lg:px-16 lg:pt-8 xl:px-24"
      {...reveal()}
    >
      <VideoModal
        open={open}
        onOpenChange={setOpen}
        videoUrl="/Logic_ui-builder-final.mp4"
      />

      <div
        className={`${styles.heroGrid} pointer-events-none absolute inset-0 hero-grid-layer`}
        aria-hidden
      />

      <motion.div
        className="z-10 flex w-full flex-col justify-center lg:w-[48%]"
        {...reveal(0.08)}
      >
        <p className="logic-display text-2xl uppercase tracking-tight text-(--logic-on-surface) sm:text-3xl">
          LOGIC
        </p>

        <h1
          className={`${styles.displayText} logic-display mt-4 text-[clamp(3rem,9vw,6.5rem)] font-black leading-[1.02] text-(--logic-on-surface)`}
        >
          TURN IDEAS
          <br />
          <span className={styles.accentText}>INTO UI</span>
          <br />
          INSTANTLY.
        </h1>

        <div
          className={`${styles.lineSweep} mt-3 h-[6px] w-full max-w-[280px] bg-(--logic-accent)`}
          aria-hidden
        />

        <p className="logic-body mt-6 max-w-md text-base leading-relaxed text-(--logic-secondary) sm:text-lg">
          Describe your vision. Get modular, responsive components ready for
          your codebase.
        </p>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/sign-up"
            className={`${styles.btnPrimary} logic-body inline-flex items-center gap-2 px-8 py-4 text-base font-semibold`}
          >
            <span>Build your first UI free</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="logic-body inline-flex cursor-pointer items-center gap-2 bg-transparent font-medium text-(--logic-secondary) transition-colors duration-200 hover:text-(--logic-on-surface)"
          >
            <PlayCircle className="h-5 w-5" aria-hidden />
            <span>Watch Demo</span>
          </button>
        </div>
      </motion.div>

      <motion.div
        className="relative mt-12 w-full lg:mt-0 lg:w-[52%] lg:pl-10"
        {...heroVisualReveal}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden border border-(--logic-border) bg-(--logic-surface-container-low)">
          <Image
            src="/hero-section.png"
            alt="LOGIC studio generating a responsive UI layout from a prompt"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 52vw"
            className="object-cover object-top"
          />
        </div>
      </motion.div>
    </motion.section>
  );
}
