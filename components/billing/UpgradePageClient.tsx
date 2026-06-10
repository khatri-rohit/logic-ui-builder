"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Check, Crown, Loader2, Lock, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useRazorpayCheckout } from "./RazorpayCheckout";
import {
  useCheckoutMutation,
  useUpgradeMutation,
  useUsageQuery,
} from "@/lib/billing/queries";
import logger from "@/lib/logger";

const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });

type PlanId = "FREE" | "STANDARD" | "PRO";

interface PlanFeature {
  label: string;
  free: boolean | string;
  standard: boolean | string;
  pro: boolean | string;
}

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: "Generations / month",
    free: "10",
    standard: "100",
    pro: "Unlimited",
  },
  { label: "Projects", free: "3", standard: "Unlimited", pro: "Unlimited" },
  { label: "Frame regeneration", free: false, standard: true, pro: true },
  {
    label: "AI Models",
    free: "1 model",
    standard: "4 models",
    pro: "All models",
  },
  { label: "Canvas export", free: false, standard: true, pro: true },
  { label: "Team seats", free: false, standard: false, pro: "Up to 5" },
  {
    label: "Generation rollover",
    free: false,
    standard: false,
    pro: "Up to 50",
  },
  { label: "Support", free: "Community", standard: "Email", pro: "Priority" },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false)
    return (
      <div className="flex h-4 items-center justify-center">
        <X className="size-3.5 text-muted-foreground" />
      </div>
    );
  if (value === true)
    return (
      <div className="flex h-4 items-center justify-center">
        <Check className="size-3.5 text-emerald-400" />
      </div>
    );
  return (
    <div className="flex h-4 items-center justify-center">
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export function UpgradePageClient() {
  const router = useRouter();
  const { data: usage, isLoading: usageLoading } = useUsageQuery();
  const { mutateAsync: subscribe } = useCheckoutMutation();
  const { mutateAsync: upgrade } = useUpgradeMutation();

  const { user } = useUser();
  const { openCheckout, checkoutState } = useRazorpayCheckout({
    email: user?.primaryEmailAddress?.emailAddress,
    onClose: () => {
      /* handled by state */
    },
  });

  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);

  const currentPlan = usage?.planId ?? "FREE";
  const periodEnd = usage?.periodEnd
    ? new Date(usage.periodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const isInGracePeriod =
    usage?.status === "CANCELLED" &&
    usage?.periodEnd &&
    new Date() < new Date(usage.periodEnd);

  const checkoutBusy =
    checkoutState === "opening" ||
    checkoutState === "modal_open" ||
    checkoutState === "verifying" ||
    checkoutState === "polling";

  const handleSubscribe = useCallback(
    async (targetPlan: "STANDARD" | "PRO") => {
      setBusyPlan(targetPlan);
      try {
        const data = await subscribe(targetPlan);
        logger.info("Subscription created, opening checkout", { data });
        await openCheckout(data.subscriptionId, data.razorpayKeyId);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "CHECKOUT_IN_PROGRESS") {
          toast.error(
            "A checkout is already in progress. Please complete or cancel it first.",
          );
        } else {
          toast.error("Failed to start checkout. Please try again.");
        }
      } finally {
        setBusyPlan(null);
      }
    },
    [subscribe, openCheckout],
  );

  const handleUpgrade = useCallback(
    async (targetPlan: "STANDARD" | "PRO") => {
      setBusyPlan(targetPlan);
      try {
        const result = await upgrade(targetPlan);
        if (result.changed) {
          toast.success(result.message ?? "Plan upgraded.");
        }
      } catch {
        toast.error("Failed to upgrade plan. Please try again.");
      } finally {
        setBusyPlan(null);
      }
    },
    [upgrade],
  );

  const plans = useMemo(
    () =>
      [
        {
          id: "FREE" as PlanId,
          name: "Free",
          price: "₹0",
          period: "",
          accent: "border-border",
          glow: "",
          textAccent: "text-muted-foreground",
          badge: "bg-muted text-muted-foreground",
        },
        {
          id: "STANDARD" as PlanId,
          name: "Standard",
          price: "₹1,499",
          period: "/mo",
          accent: "border-blue-500/25",
          glow: "shadow-[0_0_24px_-8px_rgba(59,130,246,0.25)]",
          textAccent: "text-blue-400",
          badge: "bg-blue-500/10 text-blue-400",
        },
        {
          id: "PRO" as PlanId,
          name: "Pro",
          price: "₹3,999",
          period: "/mo",
          accent: "border-amber-500/25",
          glow: "shadow-[0_0_24px_-8px_rgba(245,158,11,0.25)]",
          textAccent: "text-amber-400",
          badge: "bg-amber-500/10 text-amber-400",
        },
      ] as const,
    [],
  );

  const getCta = (planId: PlanId) => {
    if (planId === currentPlan && !usage?.scheduledPlanId && !isInGracePeriod) {
      return {
        label: "Current Plan",
        disabled: true,
        variant: "current" as const,
      };
    }

    // Grace period — everything is "subscribe"
    if (isInGracePeriod) {
      if (planId === "FREE") {
        return {
          label: `Expired${periodEnd ? ` ${periodEnd}` : ""}`,
          disabled: true,
          variant: "noop" as const,
        };
      }
      return {
        label: "Subscribe",
        disabled: false,
        variant: "subscribe" as const,
      };
    }

    // Payment pending
    if (["CREATED", "PENDING"].includes(usage?.status ?? "")) {
      if (planId === "FREE" || planId === usage?.pendingPlanId) {
        return {
          label: "Payment pending…",
          disabled: true,
          variant: "noop" as const,
        };
      }
      return {
        label: "Subscribe",
        disabled: false,
        variant: "subscribe" as const,
      };
    }

    if (planId === "FREE") {
      if (
        ["STANDARD", "PRO"].includes(currentPlan) &&
        !usage?.scheduledPlanId
      ) {
        return {
          label: `Cancel renewal · active until ${periodEnd ?? "period end"}`,
          disabled: false,
          variant: "cancel" as const,
        };
      }
      return {
        label: "Current Plan",
        disabled: true,
        variant: "current" as const,
      };
    }

    if (planId === "STANDARD") {
      if (currentPlan === "FREE") {
        return { label: "Subscribe", disabled: false, variant: "subscribe" };
      }
      if (currentPlan === "STANDARD") {
        return {
          label: "Current Plan",
          disabled: true,
          variant: "current" as const,
        };
      }
      if (currentPlan === "PRO") {
        return {
          label: "Downgrade available",
          disabled: false,
          variant: "downgrade" as const,
        };
      }
    }

    if (planId === "PRO") {
      if (currentPlan === "FREE") {
        return { label: "Subscribe", disabled: false, variant: "subscribe" };
      }
      if (currentPlan === "STANDARD") {
        return {
          label: "Upgrade now",
          disabled: false,
          variant: "upgrade" as const,
        };
      }
      if (currentPlan === "PRO") {
        return {
          label: "Current Plan",
          disabled: true,
          variant: "current" as const,
        };
      }
    }

    return { label: "—", disabled: true, variant: "noop" as const };
  };

  const handleCta = async (planId: PlanId, cta: ReturnType<typeof getCta>) => {
    if (cta.variant === "subscribe") {
      if (planId === "FREE") return;
      await handleSubscribe(planId);
      return;
    }
    if (cta.variant === "upgrade") {
      if (planId === "FREE") return;
      await handleUpgrade(planId);
      return;
    }
    if (cta.variant === "cancel") {
      router.push("/billing");
      return;
    }
    if (cta.variant === "downgrade") {
      router.push("/billing");
      return;
    }
  };

  if (usageLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-muted" />
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-8 w-28 animate-pulse rounded bg-muted" />
                <div className="mt-6 space-y-2">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="h-3 w-full animate-pulse rounded bg-muted"
                    />
                  ))}
                </div>
                <div className="mt-8 h-9 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const contextMessage =
    currentPlan === "FREE"
      ? "Choose a plan to unlock frame regeneration, code editing, and higher generation limits."
      : currentPlan === "STANDARD"
        ? "Upgrade to Pro for unlimited generations, team seats, and priority support."
        : "You're on the Pro plan. You have access to every feature.";

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-amber-500/30">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className={cn(
              "group flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground/70",
              mono.className,
            )}
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </Link>
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.3em] text-muted-foreground",
              mono.className,
            )}
          >
            Access Terminal
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        {/* Context */}
        <div className="mb-12 sm:mb-16">
          <h1
            className={cn(
              "text-3xl font-bold tracking-tight sm:text-4xl",
              mono.className,
            )}
          >
            {currentPlan === "PRO"
              ? "System at maximum capacity"
              : "Unlock more power"}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {contextMessage}
          </p>

          {/* Usage bar for current plan */}
          {usage && currentPlan !== "FREE" && usage.generationLimit > 0 && (
            <div className="mt-6 max-w-md">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Generations this period</span>
                <span className={cn(mono.className)}>
                  {usage.generationsUsed}/{usage.generationLimit}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (usage.generationsUsed / usage.generationLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Scheduled change notice */}
          {usage?.scheduledPlanId && (
            <div className="mt-6 max-w-lg rounded-lg border border-amber-500/15 bg-amber-500/3 px-4 py-3">
              <p className="text-sm text-amber-300/70">
                Your plan will change to{" "}
                <span className={cn("font-semibold", mono.className)}>
                  {usage.scheduledPlanId}
                </span>{" "}
                on {periodEnd ?? "your next billing date"}. Manage this from{" "}
                <Link
                  href="/billing"
                  className="underline underline-offset-2 hover:text-amber-200"
                >
                  Billing
                </Link>
                .
              </p>
            </div>
          )}

          {/* Cancel-at-period-end notice */}
          {usage?.cancelAtPeriodEnd && !usage?.scheduledPlanId && (
            <div className="mt-6 max-w-lg rounded-lg border border-red-500/15 bg-red-500/3 px-4 py-3">
              <p className="text-sm text-red-300/70">
                Subscription cancels on {periodEnd}. Your access continues until
                then. Reactivate from{" "}
                <Link
                  href="/billing"
                  className="underline underline-offset-2 hover:text-red-200"
                >
                  Billing
                </Link>
                .
              </p>
            </div>
          )}

          {/* Checkout state banners */}
          {(checkoutState === "verifying" || checkoutState === "polling") && (
            <div className="mt-6 max-w-lg rounded-lg border border-blue-500/15 bg-blue-500/3 px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-blue-400" />
                <p className="text-sm text-blue-300/80">
                  Waiting for payment confirmation…
                </p>
              </div>
            </div>
          )}
          {checkoutState === "timeout" && (
            <div className="mt-6 max-w-lg rounded-lg border border-amber-500/15 bg-amber-500/3 px-4 py-3">
              <p className="text-sm text-amber-300/80">
                Payment confirmation is taking longer than expected. Please
                refresh the page.
              </p>
            </div>
          )}
          {checkoutState === "failed" && (
            <div className="mt-6 max-w-lg rounded-lg border border-red-500/15 bg-red-500/3 px-4 py-3">
              <p className="text-sm text-red-300/80">
                Payment failed. Please try again.
              </p>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const cta = getCta(plan.id);
            const isCurrent =
              plan.id === currentPlan &&
              !usage?.scheduledPlanId &&
              !isInGracePeriod;
            const isBusy = busyPlan === plan.id || checkoutBusy;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-card p-5 transition-colors",
                  isCurrent ? plan.accent : "border-border",
                  isCurrent && plan.glow,
                )}
              >
                {/* Current indicator LED */}
                {isCurrent && (
                  <div className="absolute -top-px left-5 right-5 h-px">
                    <div
                      className={cn(
                        "mx-auto h-px w-16",
                        plan.id === "PRO"
                          ? "bg-amber-500/60"
                          : plan.id === "STANDARD"
                            ? "bg-blue-500/60"
                            : "bg-muted",
                      )}
                    />
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={cn(
                          "text-sm font-bold",
                          isCurrent ? plan.textAccent : "text-foreground/70",
                        )}
                      >
                        {plan.name}
                      </h3>
                      {isCurrent && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                            plan.badge,
                            mono.className,
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              plan.id === "PRO"
                                ? "bg-amber-400"
                                : plan.id === "STANDARD"
                                  ? "bg-blue-400"
                                  : "bg-muted",
                            )}
                          />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span
                        className={cn(
                          "text-2xl font-bold tracking-tight",
                          mono.className,
                          isCurrent ? "text-foreground" : "text-foreground/80",
                        )}
                      >
                        {plan.price}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  {plan.id === "PRO" && (
                    <Crown
                      className={cn(
                        "size-5",
                        isCurrent ? "text-amber-400" : "text-foreground/10",
                      )}
                    />
                  )}
                  {plan.id === "STANDARD" && (
                    <Zap
                      className={cn(
                        "size-5",
                        isCurrent ? "text-blue-400" : "text-foreground/10",
                      )}
                    />
                  )}
                  {plan.id === "FREE" && (
                    <Lock
                      className={cn(
                        "size-5",
                        isCurrent
                          ? "text-muted-foreground"
                          : "text-foreground/10",
                      )}
                    />
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  {PLAN_FEATURES.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-2.5"
                    >
                      <FeatureValue
                        value={
                          feature[
                            plan.id.toLowerCase() as "free" | "standard" | "pro"
                          ]
                        }
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleCta(plan.id, cta)}
                  disabled={cta.disabled || isBusy}
                  size="sm"
                  className={cn(
                    "mt-5 h-9 w-full cursor-pointer text-xs font-semibold",
                    cta.variant === "current"
                      ? "border border-border bg-transparent text-muted-foreground"
                      : cta.variant === "upgrade"
                        ? "bg-amber-500 text-black hover:bg-amber-400"
                        : cta.variant === "subscribe"
                          ? plan.id === "PRO"
                            ? "bg-amber-500 text-black hover:bg-amber-400"
                            : "bg-blue-500 text-foreground hover:bg-blue-400"
                          : cta.variant === "cancel"
                            ? "border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
                            : cta.variant === "downgrade"
                              ? "border border-border bg-transparent text-muted-foreground hover:bg-muted"
                              : "border border-border bg-transparent text-foreground/20",
                    mono.className,
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {cta.label}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Feature matrix */}
        <div className="mt-16 sm:mt-20">
          <h2
            className={cn(
              "text-[10px] uppercase tracking-[0.25em] text-muted-foreground",
              mono.className,
            )}
          >
            Capabilities Matrix
          </h2>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th
                    className={cn(
                      "px-4 py-2.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground",
                      mono.className,
                    )}
                  >
                    Feature
                  </th>
                  <th
                    className={cn(
                      "px-4 py-2.5 text-center text-[10px] font-normal uppercase tracking-wider text-muted-foreground",
                      mono.className,
                    )}
                  >
                    Free
                  </th>
                  <th
                    className={cn(
                      "px-4 py-2.5 text-center text-[10px] font-normal uppercase tracking-wider text-muted-foreground",
                      mono.className,
                    )}
                  >
                    Standard
                  </th>
                  <th
                    className={cn(
                      "px-4 py-2.5 text-center text-[10px] font-normal uppercase tracking-wider text-muted-foreground",
                      mono.className,
                    )}
                  >
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((feature, index) => (
                  <tr
                    key={feature.label}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-muted",
                      index === PLAN_FEATURES.length - 1 && "border-b-0",
                    )}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {feature.label}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <FeatureValue value={feature.free} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <FeatureValue value={feature.standard} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <FeatureValue value={feature.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
