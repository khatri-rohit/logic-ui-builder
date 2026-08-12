"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn, revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";

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
      "Frame regeneration",
      "Canvas export",
      "Up to 5 team seats",
      "Priority support",
    ],
    cta: "Get Pro",
  },
];

// Feature rows for the comparison table
const FEATURE_ROWS = [
  { label: "Price", key: "price" as const },
  { label: "Generations", key: "gen" as const },
  { label: "Projects", key: "projects" as const },
  { label: "Models", key: "models" as const },
  { label: "Support", key: "support" as const },
];

const PLAN_FEATURES: Record<PlanId, Record<string, string>> = {
  FREE: { price: "₹0", gen: "10 / mo", projects: "3", models: "1", support: "Community" },
  STANDARD: { price: "₹1,499", gen: "100 / mo", projects: "∞", models: "4", support: "Email" },
  PRO: { price: "₹3,999", gen: "∞", projects: "∞", models: "All", support: "Priority" },
};

export function PricingSection() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  const handleLandingPlanCta = (planId: PlanId) => {
    if (planId === "FREE") {
      router.push("/sign-up");
      return;
    }
    try {
      sessionStorage.setItem("pendingPlanId", planId);
    } catch {
      /* ignore */
    }
    router.push("/sign-up");
  };

  return (
    <section className="border-t border-(--logic-border-soft) bg-(--logic-surface) py-32">
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

        {/* Comparison Table — Desktop */}
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
              {/* CTA row */}
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
                    <button
                      type="button"
                      onClick={() => handleLandingPlanCta(plan.id)}
                      className={cn(
                        "logic-body w-full border py-3 text-sm font-bold transition-colors",
                        plan.highlight
                          ? "border-(--logic-accent) bg-(--logic-accent) text-white hover:bg-(--logic-accent-deep)"
                          : "border-(--logic-border) bg-transparent text-(--logic-on-surface) hover:border-(--logic-on-surface)",
                      )}
                    >
                      {plan.cta}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </motion.div>

        {/* Stacked Cards — Mobile */}
        <motion.div className="flex flex-col gap-6 lg:hidden" {...reveal(0.08)}>
          {LANDING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "border p-6",
                plan.highlight
                  ? "border-l-4 border-l-(--logic-accent) border-(--logic-border) bg-(--logic-accent-muted)"
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
                <span className="text-sm text-(--logic-secondary)">
                  {plan.period}
                </span>
              </div>
              <p className="logic-body mt-1 text-sm text-(--logic-secondary)">
                {plan.description}
              </p>
              <div className="mt-4 text-sm text-(--logic-secondary)">
                {PLAN_FEATURES[plan.id].gen} generations &bull;{" "}
                {PLAN_FEATURES[plan.id].projects} projects
              </div>
              <button
                type="button"
                onClick={() => handleLandingPlanCta(plan.id)}
                className={cn(
                  "logic-body mt-4 w-full border py-3 text-sm font-bold transition-colors",
                  plan.highlight
                    ? "border-(--logic-accent) bg-(--logic-accent) text-white"
                    : "border-(--logic-border) text-(--logic-on-surface)",
                )}
              >
                {plan.cta}
              </button>
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
