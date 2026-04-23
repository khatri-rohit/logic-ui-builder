"use client";

import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";
import { CheckoutButton } from "../billing/CheckoutButton";

type PricingFeature = {
  label: string;
  included: boolean;
};

type PricingTier = {
  name: "FREE" | "STANDARD" | "PRO";
  price: string;
  description: string;
  features: PricingFeature[];
  ctaLabel: string;
  featured?: boolean;
};

const PRICING_TIERS: PricingTier[] = [
  {
    name: "FREE",
    price: "\u20b90",
    description: "Perfect for exploring the capabilities.",
    ctaLabel: "Start Free",
    features: [
      { label: "10 Generations / month", included: true },
      { label: "3 Projects", included: true },
      { label: "Frame regeneration", included: false },
      { label: "Team seats", included: false },
    ],
  },
  {
    name: "STANDARD",
    price: "\u20b91,499",
    description: "For dedicated designers and solo devs.",
    ctaLabel: "Upgrade to Standard",
    featured: true,
    features: [
      { label: "100 Generations / month", included: true },
      { label: "Unlimited Projects", included: true },
      { label: "Frame regeneration", included: true },
      { label: "Team seats", included: false },
    ],
  },
  {
    name: "PRO",
    price: "\u20b93,999",
    description: "For scaling teams and agencies.",
    ctaLabel: "Go Pro",
    features: [
      { label: "Unlimited Generations", included: true },
      { label: "Unlimited Projects", included: true },
      { label: "Frame regeneration", included: true },
      { label: "Up to 5 Team seats", included: true },
    ],
  },
];

export function PricingSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="border-y border-(--logic-border-soft) bg-(--logic-surface) py-32"
    >
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div
          className="mx-auto mb-16 max-w-2xl text-center"
          {...reveal()}
        >
          <h2
            id="pricing-heading"
            className={`${styles.displayText} mb-4 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
          >
            Pricing that scales.
          </h2>
          <p className="logic-body text-lg text-(--logic-secondary)">
            Choose the tier that fits your workflow. No hidden fees, just raw
            generative power.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:items-start">
          {PRICING_TIERS.map((tier, index) => (
            <motion.article
              key={tier.name}
              className={`relative flex h-full flex-col rounded-xl border border-(--logic-border-soft) bg-(--logic-surface-container-lowest) p-8 ${styles.ambientShadow} ${tier.featured ? styles.pricingFeaturedCard : ""}`}
              {...reveal(index * 0.08)}
            >
              {tier.featured ? (
                <div className="pointer-events-none absolute inset-x-0 -top-4 flex justify-center">
                  <span className={styles.pricingBadge}>Most Popular</span>
                </div>
              ) : null}

              <div className="mb-8">
                <h3 className="mb-2 text-xl font-bold text-(--logic-on-surface)">
                  {tier.name}
                </h3>
                <div className="mb-2 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-(--logic-on-surface)">
                    {tier.price}
                  </span>
                  <span className="logic-body pb-1 text-sm text-(--logic-secondary)">
                    /mo
                  </span>
                </div>
                <p className="logic-body text-sm text-(--logic-secondary)">
                  {tier.description}
                </p>
              </div>

              <ul className="mb-8 flex flex-1 flex-col gap-4">
                {tier.features.map((feature) => (
                  <li
                    key={feature.label}
                    className={`logic-body flex items-center gap-3 text-sm ${feature.included ? "text-(--logic-on-surface)" : "text-(--logic-muted)"}`}
                  >
                    {feature.included ? (
                      <Check
                        className="h-4 w-4 text-(--logic-primary-fixed)"
                        aria-hidden
                      />
                    ) : (
                      <X
                        className="h-4 w-4 text-(--logic-border)"
                        aria-hidden
                      />
                    )}
                    <span>{feature.label}</span>
                  </li>
                ))}
              </ul>

              <CheckoutButton
                className={
                  tier.featured
                    ? `${styles.pricingPrimaryCta} logic-body`
                    : `${styles.pricingSecondaryCta} logic-body`
                }
                planId={tier.name}
                label={tier.ctaLabel}
              />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
