"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

const TYPESCALE = [
  { label: "Display", size: "4rem", weight: "400", font: "logic-display" },
  { label: "Headline", size: "2.5rem", weight: "400", font: "logic-display" },
  { label: "Title", size: "1.5rem", weight: "700", font: "logic-body" },
  { label: "Body", size: "1rem", weight: "400", font: "logic-body" },
  { label: "Label", size: "0.75rem", weight: "600", font: "logic-mono" },
];

const QUALITY_CHECKS = [
  "Strict token adherence",
  "Semantic HTML5 structures",
  "Accessible contrast ratios",
];

export function DetailSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  return (
    <section className="bg-(--logic-surface-container-low) py-32">
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div className="mb-16 max-w-2xl" {...reveal()}>
          <p className="logic-mono mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-(--logic-accent)">
            Craft
          </p>
          <h2
            className={`${styles.displayText} logic-display text-[clamp(2rem,5vw,4rem)] font-bold text-(--logic-on-surface)`}
          >
            Obsessive Detail.
          </h2>
          <p className="logic-body mt-4 max-w-lg text-lg text-(--logic-secondary)">
            We do not just output divs. Every component respects typographic
            hierarchy, accessibility standards, and responsive behaviors out
            of the box.
          </p>
        </motion.div>

        <motion.div
          className="border border-(--logic-border) bg-(--logic-surface) p-8 lg:p-12"
          {...reveal(0.08)}
        >
          <p className="logic-mono mb-8 text-xs font-semibold uppercase tracking-[0.15em] text-(--logic-secondary)">
            Typography Scale
          </p>

          <div className="space-y-0">
            {TYPESCALE.map((item, index) => (
              <div key={item.label} className={styles.specimenRow}>
                <motion.div
                  className={styles.specimenBar}
                  aria-hidden
                  initial={shouldReduceMotion ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.06,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                />
                <div className={styles.specimenSample}>
                  <span
                    className={`${item.font} block`}
                    style={{
                      fontSize: item.size,
                      fontWeight: item.weight,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </span>
                  <span className="logic-mono mt-0.5 block text-[10px] uppercase tracking-widest text-(--logic-secondary)">
                    {item.size} / {item.font}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="mt-12" {...reveal(0.12)}>
          <div className="flex flex-wrap gap-6">
            {QUALITY_CHECKS.map((item) => (
              <div
                key={item}
                className="logic-body inline-flex items-center gap-3 border border-(--logic-border) px-5 py-3 text-sm font-medium text-(--logic-on-surface)"
              >
                <Check className="h-4 w-4 text-(--logic-accent)" aria-hidden />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
