"use client";

import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

type ProcessStep = {
  step: string;
  title: string;
  description: string;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    step: "01",
    title: "Describe the Intent",
    description:
      "Input your requirements in plain language or structured JSON. LOGIC interprets the semantic intent of your layout.",
  },
  {
    step: "02",
    title: "Generate & Refine",
    description:
      "The engine constructs the UI using your defined design system tokens, ensuring consistency across every breakpoint.",
  },
  {
    step: "03",
    title: "Export Clean Code",
    description:
      "Output semantically precise HTML and Tailwind CSS, ready to be dropped into your production environment.",
  },
];

export function ProcessSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  return (
    <section id="process" className="scroll-mt-20 bg-(--logic-surface) py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div className="mb-20 max-w-2xl" {...reveal()}>
          <p className="logic-mono mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-(--logic-accent)">
            How It Works
          </p>
          <h2
            className={`${styles.displayText} logic-display text-[clamp(2rem,5vw,4rem)] font-bold text-(--logic-on-surface)`}
          >
            The Process
          </h2>
          <p className="logic-body mt-4 text-lg text-(--logic-secondary)">
            A deliberate, structured approach to generating structural
            interfaces without the boilerplate.
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-3 lg:gap-0">
          {PROCESS_STEPS.map((step, index) => (
            <motion.div
              key={step.step}
              className="relative flex flex-col lg:px-6"
              {...reveal(index * 0.1)}
            >
              {index < PROCESS_STEPS.length - 1 && (
                <div
                  className={`${styles.processConnector} hidden lg:block`}
                  aria-hidden
                >
                  <motion.div
                    className={styles.processConnectorFill}
                    initial={shouldReduceMotion ? false : { scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 1, 0.5, 1] }}
                  />
                </div>
              )}

              <div className={`${styles.stepNumber} logic-display`}>
                {step.step}
              </div>

              <h3 className="logic-body mt-4 text-xl font-bold text-(--logic-on-surface)">
                {step.title}
              </h3>

              <p className="logic-body mt-3 max-w-[30ch] leading-relaxed text-(--logic-secondary)">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
