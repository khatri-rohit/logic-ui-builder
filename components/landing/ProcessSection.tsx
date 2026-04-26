"use client";

import type { LucideIcon } from "lucide-react";
import { PenLine, Wand2, Terminal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

type ProcessStep = {
  step: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    step: "01",
    title: "Describe the Intent",
    description:
      "Input your requirements in plain language or structured JSON. LOGIC interprets the semantic intent of your layout.",
    Icon: PenLine,
  },
  {
    step: "02",
    title: "Generate & Refine",
    description:
      "The engine constructs the UI using your defined design system tokens, ensuring consistency across every breakpoint.",
    Icon: Wand2,
  },
  {
    step: "03",
    title: "Export Clean Code",
    description:
      "Output semantically precise HTML and Tailwind CSS, ready to be dropped into your production environment.",
    Icon: Terminal,
  },
];

export function ProcessSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  return (
    <section id="logic-process" className="bg-(--logic-surface) py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div className="mb-24 max-w-2xl" {...reveal()}>
          <h2
            className={`${styles.displayText} mb-6 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
          >
            The Process
          </h2>
          <p className="logic-body text-lg text-(--logic-secondary)">
            A deliberate, structured approach to generating structural
            interfaces without the boilerplate.
          </p>
        </motion.div>

        <div className="flex flex-col gap-24">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = step.Icon;

            return (
              <motion.article
                key={step.step}
                className="group flex flex-col items-start gap-12 lg:flex-row"
                {...reveal(index * 0.08)}
              >
                <div className="text-8xl font-black text-(--logic-surface-container-high) transition-colors duration-200 group-hover:text-(--logic-primary-fixed)">
                  {step.step}
                </div>
                <div className="flex-1 pt-4">
                  <div className="mb-4 flex items-center gap-4">
                    <Icon
                      className="h-5 w-5 text-(--logic-primary-fixed)"
                      aria-hidden
                    />
                    <h3 className="text-2xl font-bold text-(--logic-on-surface)">
                      {step.title}
                    </h3>
                  </div>
                  <p className="logic-body max-w-md leading-relaxed text-(--logic-secondary)">
                    {step.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
