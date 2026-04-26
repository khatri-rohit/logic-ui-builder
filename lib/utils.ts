import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_PROMPT =
  "Design a premium SaaS dashboard with responsive cards and analytics charts.";

export const STANDARD_EASE: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

export const revealAnimation = (
  shouldReduceMotion: boolean | null,
  delay = 0,
) =>
  shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: {
          duration: 0.6,
          delay,
          ease: STANDARD_EASE,
        },
      };

export const heroVisualRevealAnimation = (
  shouldReduceMotion: boolean | null,
) =>
  shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: 42, scale: 0.98 },
        animate: { opacity: 1, x: 0, scale: 1 },
        transition: { duration: 0.8, delay: 0.2, ease: STANDARD_EASE },
      };
