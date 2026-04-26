"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
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
      className="flex items-center justify-center bg-(--logic-surface) px-8 py-48 text-center"
      {...reveal()}
    >
      <div className="max-w-3xl">
        <h2
          className={`${styles.displayText} mb-12 text-5xl font-extrabold text-(--logic-on-surface) lg:text-7xl`}
        >
          Ready to build?
        </h2>
        <Button
          type="button"
          onClick={startOnboarding}
          className={`${styles.btnPrimary} logic-body rounded-md px-12 py-8 text-lg font-bold`}
        >
          Generate your first UI
        </Button>
      </div>
    </motion.section>
  );
}
