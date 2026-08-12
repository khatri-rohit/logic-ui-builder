"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

export function CTASection() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const reveal = () => revealAnimation(shouldReduceMotion);

  const startOnboarding = () => {
    router.push("/sign-up");
  };

  return (
    <motion.section
      className={`${styles.ctaSection} flex items-center justify-center px-8 py-48 text-center`}
      {...reveal()}
    >
      <div className="max-w-4xl">
        <h2
          className={`${styles.displayText} logic-display text-[clamp(4rem,12vw,9rem)] font-black leading-[1.05] text-white`}
        >
          READY TO
          <br />
          BUILD?
        </h2>
        <button
          type="button"
          onClick={startOnboarding}
          className="logic-body mt-12 inline-block bg-white px-12 py-4 text-lg font-bold text-[#0a0a0a] transition-colors hover:bg-[#ff6d00] hover:text-white"
        >
          Generate your first UI
        </button>
      </div>
    </motion.section>
  );
}
