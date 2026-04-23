"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PROMPT,
  heroVisualRevealAnimation,
  revealAnimation,
} from "@/lib/utils";
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
    try {
      sessionStorage.setItem("initialPrompt", DEFAULT_PROMPT);
    } catch {
      // Continue if session storage is unavailable.
    }
    router.push("/sign-up");
  };

  return (
    <motion.section
      className="relative mx-auto md:m-0 flex min-h-screen w-full flex-col items-center gap-16 overflow-hidden px-6 py-20 lg:flex-row lg:gap-24 lg:px-8 xl:px-12 lg:py-0"
      {...reveal()}
    >
      <VideoModal
        open={open}
        onOpenChange={setOpen}
        videoUrl="/Logic_ui-builder-final.mp4"
      />
      <motion.div
        className="z-10 flex w-full flex-col justify-center space-y-10 pt-12 lg:w-1/2 lg:flex-1 lg:pt-0 lg:px-15 xl:px-24"
        {...reveal(0.08)}
      >
        <div className="inline-flex w-max items-center space-x-2 rounded-full bg-(--logic-surface-container-low) px-4 py-2">
          <Sparkles
            className="h-4 w-4 text-(--logic-primary-fixed)"
            aria-hidden
          />
          <span
            className={`${styles.labelText} logic-body text-xs font-bold text-(--logic-secondary)`}
          >
            AI-Powered Design
          </span>
        </div>

        <h1
          className={`${styles.displayText} text-5xl font-extrabold text-(--logic-on-surface) lg:text-5xl xl:text-6xl 2xl:text-7xl`}
        >
          Turn ideas into <br />
          <span className={styles.gradientText}>production-ready</span> <br />
          UI instantly.
        </h1>

        <p className="logic-body max-w-lg text-lg leading-relaxed text-(--logic-secondary) lg:text-base xl:text-xl">
          Skip the boilerplate. Describe your vision, and our engine generates
          modular, responsive components ready for your codebase.
        </p>

        <div className="flex flex-col items-start gap-6 pt-4 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={startOnboarding}
            className={`${styles.btnPrimary} logic-body inline-flex items-center gap-2 rounded-md px-8 py-6.5 text-base font-semibold cursor-pointer`}
          >
            <span>Build your first UI free</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="logic-body bg-transparent inline-flex items-center gap-2 font-medium text-(--logic-secondary) transition-colors duration-200 hover:bg-transparent hover:text-(--logic-on-surface) cursor-pointer"
          >
            <PlayCircle className="h-5 w-5" aria-hidden />
            <span>Watch Demo</span>
          </Button>
        </div>
      </motion.div>

      <motion.div
        className={`relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-2xl bg-(--logic-surface-container-low) p-4 sm:p-6 md:p-8 lg:w-10/12 lg:flex-1 ${styles.ambientShadow}`}
        {...heroVisualReveal}
      >
        <div className="absolute inset-0 bg-linear-to-br from-[rgba(133,130,255,0.2)] to-transparent mix-blend-multiply" />
        <div
          className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-(--logic-surface-container-lowest) ${styles.cardShadow}`}
        >
          <div className="flex h-10 items-center gap-2 border-b border-[rgba(169,180,185,0.25)] bg-(--logic-surface-container-low) px-4">
            <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[rgba(169,180,185,0.5)]" />
          </div>
          <div className="relative min-h-0 flex-1 w-full">
            <Image
              fill
              priority
              sizes="(min-width: 1280px) 42vw, (min-width: 1024px) 46vw, (min-width: 640px) 88vw, 92vw"
              src="/hero-section.png"
              alt="Production UI preview with layered interface panels"
              className="object-cover object-center"
            />
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
