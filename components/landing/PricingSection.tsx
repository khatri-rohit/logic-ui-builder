"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { cn, revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";

type PlanId = "FREE" | "STANDARD" | "PRO";

const LANDING_PLANS = [
  {
    id: "FREE" as const,
    name: "Free",
    price: "₹0",
    period: "",
    description: "Explore what LOGIC can do.",
    highlight: false,
    features: [
      "10 generations / month",
      "3 projects",
      "1 model",
      "Community support",
    ],
    cta: "Start for free",
  },
  {
    id: "STANDARD" as const,
    name: "Standard",
    price: "₹1,499",
    period: "/mo",
    description: "For solo designers and developers.",
    highlight: false,
    features: [
      "100 generations / month",
      "Unlimited projects",
      "4 models",
      "Frame regeneration",
      "Canvas export",
      "Email support",
    ],
    cta: "Get Standard",
  },
  {
    id: "PRO" as const,
    name: "Pro",
    price: "₹3,999",
    period: "/mo",
    description: "For teams that ship fast.",
    highlight: true,
    features: [
      "Unlimited generations",
      "Unlimited projects",
      "All models",
      "Up to 5 team seats",
      "Canvas export",
      "Priority support",
    ],
    cta: "Get Pro",
  },
];

const FEATURE_ROWS = [
  { label: "Price", key: "price" as const },
  { label: "Generations", key: "gen" as const },
  { label: "Projects", key: "projects" as const },
  { label: "Models", key: "models" as const },
  { label: "Support", key: "support" as const },
];

const PLAN_FEATURES: Record<PlanId, Record<string, string>> = {
  FREE: {
    price: "₹0",
    gen: "10 / mo",
    projects: "3",
    models: "1",
    support: "Community",
  },
  STANDARD: {
    price: "₹1,499",
    gen: "100 / mo",
    projects: "∞",
    models: "4",
    support: "Email",
  },
  PRO: {
    price: "₹3,999",
    gen: "∞",
    projects: "∞",
    models: "All",
    support: "Priority",
  },
};

function planHref(planId: PlanId) {
  if (planId === "FREE") {
    return "/sign-up";
  }

  return `/sign-up?plan=${planId}`;
}

function stashPendingPlan(planId: PlanId) {
  if (planId === "FREE" || typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem("pendingPlanId", planId);
  } catch {
    /* ignore */
  }
}

export function PricingSection() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-(--logic-border-soft) bg-(--logic-surface) py-32"
    >
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div className="mx-auto mb-20 max-w-2xl" {...reveal()}>
          <p className="logic-mono mb-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-(--logic-accent)">
            Pricing
          </p>
          <h2
            className={`${styles.displayText} logic-display text-center text-[clamp(2rem,5vw,4rem)] font-bold text-(--logic-on-surface)`}
          >
            Simple, Transparent Pricing
          </h2>
          <p className="logic-body mt-4 text-center text-lg text-(--logic-secondary)">
            Start free. Scale when you need to.
          </p>
        </motion.div>

        <motion.div className="hidden overflow-x-auto lg:block" {...reveal(0.08)}>
          <table className={styles.pricingTable}>
            <thead>
              <tr>
                <th className="w-[200px]" />
                {LANDING_PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    className={cn(
                      plan.highlight ? styles.pricingHighlight : "",
                      "min-w-[180px]",
                    )}
                  >
                    <span className="logic-display text-base uppercase tracking-normal text-(--logic-on-surface)">
                      {plan.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="logic-mono text-xs uppercase tracking-widest text-(--logic-secondary)">
                    {row.label}
                  </td>
                  {LANDING_PLANS.map((plan) => (
                    <td
                      key={plan.id}
                      className={cn(
                        plan.highlight ? styles.pricingHighlight : "",
                        "font-semibold",
                      )}
                    >
                      {PLAN_FEATURES[plan.id][row.key]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {LANDING_PLANS.map((plan) => (
                  <td
                    key={plan.id}
                    className={cn(
                      plan.highlight ? styles.pricingHighlight : "",
                      "border-b-0 pt-6",
                    )}
                  >
                    <Link
                      href={planHref(plan.id)}
                      onClick={() => stashPendingPlan(plan.id)}
                      className={cn(
                        "logic-body inline-flex w-full items-center justify-center border py-3 text-sm font-bold transition-colors",
                        plan.highlight
                          ? "border-(--logic-accent) bg-(--logic-accent) text-white hover:bg-(--logic-accent-deep)"
                          : "border-(--logic-border) bg-transparent text-(--logic-on-surface) hover:border-(--logic-on-surface)",
                      )}
                    >
                      {plan.cta}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </motion.div>

        <motion.div className="flex flex-col gap-6 lg:hidden" {...reveal(0.08)}>
          {LANDING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "border p-6",
                plan.highlight
                  ? "border-(--logic-border) border-l-4 border-l-(--logic-accent) bg-(--logic-accent-muted)"
                  : "border-(--logic-border) bg-(--logic-surface-container-lowest)",
              )}
            >
              <h3 className="logic-display text-xl uppercase tracking-tight text-(--logic-on-surface)">
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-(--logic-on-surface)">
                  {plan.price}
                </span>
                {plan.period ? (
                  <span className="text-sm text-(--logic-secondary)">
                    {plan.period}
                  </span>
                ) : null}
              </div>
              <p className="logic-body mt-1 text-sm text-(--logic-secondary)">
                {plan.description}
              </p>
              <ul className="logic-body mt-4 space-y-2 text-sm text-(--logic-on-surface)">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-(--logic-accent)" aria-hidden>
                      —
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={planHref(plan.id)}
                onClick={() => stashPendingPlan(plan.id)}
                className={cn(
                  "logic-body mt-5 inline-flex w-full items-center justify-center border py-3 text-sm font-bold transition-colors",
                  plan.highlight
                    ? "border-(--logic-accent) bg-(--logic-accent) text-white hover:bg-(--logic-accent-deep)"
                    : "border-(--logic-border) text-(--logic-on-surface) hover:border-(--logic-on-surface)",
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </motion.div>

        <p className="mt-8 text-center text-sm text-(--logic-secondary)">
          All prices include 18% GST. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
