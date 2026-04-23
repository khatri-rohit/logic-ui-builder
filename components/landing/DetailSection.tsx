"use client";

import { Check, MonitorSmartphone, Code2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

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
        <div className="flex flex-col items-center gap-24 lg:flex-row">
          <motion.div className="w-full lg:w-1/2" {...reveal()}>
            <h2
              className={`${styles.displayText} mb-6 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
            >
              Obsessive Detail.
            </h2>
            <p className="logic-body mb-12 max-w-md text-lg text-(--logic-secondary)">
              We do not just output divs. Every component respects typographic
              hierarchy, accessibility standards, and responsive behaviors out
              of the box.
            </p>
            <ul className="space-y-6">
              {QUALITY_CHECKS.map((item) => (
                <li
                  key={item}
                  className="logic-body flex items-center gap-4 font-medium text-(--logic-on-surface)"
                >
                  <Check
                    className="h-5 w-5 text-(--logic-secondary)"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="grid w-full grid-cols-2 gap-4 lg:w-1/2"
            {...reveal(0.08)}
          >
            <div
              className={`col-span-2 flex flex-col justify-center rounded-xl bg-(--logic-surface-container-lowest) p-8 ${styles.ambientShadow}`}
            >
              <span
                className={`${styles.labelText} logic-body mb-4 text-xs text-(--logic-secondary)`}
              >
                Typography Scale
              </span>
              <div className="space-y-2">
                <div className="text-4xl font-extrabold text-(--logic-on-surface)">
                  Display
                </div>
                <div className="text-2xl font-bold text-(--logic-on-surface)">
                  Headline
                </div>
                <div className="logic-body text-lg font-semibold text-(--logic-secondary)">
                  Title
                </div>
                <div className="logic-body text-sm text-(--logic-secondary)">
                  Body
                </div>
              </div>
            </div>

            <div
              className={`flex min-h-40 flex-col items-center justify-center rounded-xl bg-(--logic-surface-container-lowest) p-6 ${styles.ambientShadow}`}
            >
              <MonitorSmartphone
                className="mb-2 h-8 w-8 text-(--logic-secondary)"
                aria-hidden
              />
              <span className="logic-body text-center text-sm font-semibold text-(--logic-on-surface)">
                Responsive By Default
              </span>
            </div>

            <div
              className={`flex min-h-40 flex-col items-start justify-center rounded-xl bg-(--logic-surface-container-lowest) p-6 ${styles.ambientShadow}`}
            >
              <Code2
                className="mb-2 h-6 w-6 text-(--logic-primary-fixed)"
                aria-hidden
              />
              <div className="mb-2 h-8 w-8 rounded bg-(--logic-primary-fixed)" />
              <div className="mb-2 h-8 w-8 rounded bg-(--logic-surface-container-high)" />
              <span className="logic-body text-xs font-medium text-(--logic-secondary)">
                Token Mapping
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
