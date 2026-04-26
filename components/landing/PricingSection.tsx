"use client";

import { Check, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn, revealAnimation } from "@/lib/utils";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
// import { LANDING_PLANS } from "@/lib/pricing";

export function PricingSection() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const reveal = (delay = 0) => revealAnimation(shouldReduceMotion, delay);

  // Plan data array (inside LandingPage component)
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
        // "1 AI model (Gemma 4)",
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
        // "4 AI models",
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
        // "All AI models",
        "Frame regeneration",
        "Canvas export",
        "Up to 5 team seats",
        "50 generation rollover",
        "Priority support",
      ],
      cta: "Get Pro",
    },
  ];

  const handleLandingPlanCta = (planId: "FREE" | "STANDARD" | "PRO") => {
    if (planId === "FREE") {
      router.push("/sign-up");
      return;
    }
    // Store intent so post-sign-up flow can pick it up
    try {
      sessionStorage.setItem("pendingPlanId", planId);
    } catch {
      /* ignore */
    }
    router.push("/sign-up");
  };

  return (
    <section
      id="pricing"
      className="bg-(--logic-surface-container-low) py-32 border-t border-(--logic-border-soft)"
    >
      <div className="mx-auto max-w-7xl px-8 lg:px-24">
        <motion.div className="mb-20 max-w-2xl mx-auto" {...reveal()}>
          <h2
            className={`${styles.displayText} mb-4 text-4xl font-bold text-(--logic-on-surface) lg:text-5xl`}
          >
            Simple, Transparent Pricing
          </h2>
          <p className="logic-body text-lg text-(--logic-secondary)">
            Start free. Scale when you need to.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {LANDING_PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.highlight
                  ? "border-(--logic-primary-fixed)/40 bg-(--logic-surface-container-lowest)"
                  : "border-(--logic-border-soft) bg-(--logic-surface-container-lowest)",
                styles.cardShadow,
              )}
              {...reveal(index * 0.06)}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 rounded-full bg-(--logic-primary-fixed) px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="size-3" /> Most Popular
                </span>
              )}

              <p className="text-sm font-semibold uppercase tracking-widest text-(--logic-secondary)">
                {plan.name}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-(--logic-on-surface)">
                  {plan.price}
                </span>
                <span className="text-sm text-(--logic-secondary)">
                  {plan.period}
                </span>
              </div>
              <p className="logic-body mt-2 text-sm text-(--logic-secondary)">
                {plan.description}
              </p>

              <ul className="mt-8 flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm text-(--logic-on-surface)"
                  >
                    <Check className="size-4 shrink-0 text-(--logic-primary-fixed)" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => handleLandingPlanCta(plan.id)}
                className={cn(
                  "logic-body mt-auto pt-8 w-full rounded-md py-6 font-semibold text-sm",
                  plan.highlight ? styles.btnPrimary : styles.btnSecondary,
                )}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-(--logic-secondary)">
          All prices include 18% GST. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
