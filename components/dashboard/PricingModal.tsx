"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { JetBrains_Mono } from "next/font/google";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useUsageQuery,
  useCheckoutMutation,
  useUpgradeMutation,
  useScheduleDowngradeMutation,
  useUndoDowngradeMutation,
  useCancelMutation,
} from "@/lib/billing/queries";
import { useUser } from "@clerk/nextjs";
import { useRazorpayCheckout } from "../billing/RazorpayCheckout";
import logger from "@/lib/logger";

const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });

interface PricingModalProps {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}

interface PlanFeature {
  label: string;
  free: boolean | string;
  standard: boolean | string;
  pro: boolean | string;
}

// Derive the CTA label and action for each plan column
type CtaVariant =
  | "current"
  | "subscribe"
  | "upgrade"
  | "schedule_downgrade"
  | "cancel_renewal"
  | "undo_downgrade"
  | "expired"
  | "noop";

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
  { label: "Support", free: "Community", standard: "Email", pro: "Priority" },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false) return <X className="size-3.5 text-white/25" />;
  if (value === true) return <Check className="size-3.5 text-emerald-400" />;
  return <span className="text-xs text-white/70">{value}</span>;
}

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const { data: usage, isLoading: usageLoading } = useUsageQuery();
  const { mutateAsync: subscribe, isPending: subscribing } =
    useCheckoutMutation();
  const { mutateAsync: upgrade, isPending: upgrading } = useUpgradeMutation();
  const { mutateAsync: scheduleDowngrade, isPending: scheduling } =
    useScheduleDowngradeMutation();
  const { mutateAsync: undoDowngrade, isPending: undoing } =
    useUndoDowngradeMutation();
  const { mutateAsync: cancel, isPending: cancelling } = useCancelMutation();

  const { user } = useUser();
  const { openCheckout, checkoutState, resetCheckout } = useRazorpayCheckout({
    email: user?.primaryEmailAddress?.emailAddress,
    onClose: () => {
      /* panel can stay open or close */
    },
  });

  // Reset checkout state machine when modal closes
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      resetCheckout();
      setConfirmingCancel(false);
    }
    onOpenChange(value);
  };

  const checkoutBusy =
    checkoutState === "opening" ||
    checkoutState === "modal_open" ||
    checkoutState === "verifying" ||
    checkoutState === "polling";

  const anyLoading =
    subscribing ||
    upgrading ||
    scheduling ||
    undoing ||
    cancelling ||
    checkoutBusy;
  const currentPlan = usage?.planId ?? "FREE";
  const scheduledPlan = usage?.scheduledPlanId;
  const periodEnd = usage?.periodEnd
    ? new Date(usage.periodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  // Grace period check
  const isInGracePeriod =
    usage?.status === "CANCELLED" &&
    usage?.periodEnd &&
    new Date() < new Date(usage.periodEnd);

  const handleSubscribeOrChange = async (
    targetPlan: "FREE" | "STANDARD" | "PRO",
  ) => {
    if (targetPlan === "FREE") return;
    if (currentPlan === "FREE" || isInGracePeriod) {
      try {
        const data = await subscribe(targetPlan);
        logger.info("Subscription created, opening checkout", { data });
        const opened = await openCheckout(data.subscriptionId, data.razorpayKeyId);
        if (opened) {
          onOpenChange(false);
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "CHECKOUT_IN_PROGRESS") {
          toast.error(
            "A checkout is already in progress. Please complete or cancel it first.",
          );
        } else {
          toast.error("Failed to start checkout. Please try again.");
        }
      }
      return;
    }

    // Paid users: use upgrade (no checkout needed)
    try {
      const result = await upgrade(targetPlan);
      if (result.changed) {
        toast.success(result.message ?? "Plan upgraded.");
      }
    } catch {
      toast.error("Failed to upgrade plan. Please try again.");
    }
  };

  const handleScheduleDowngrade = async (targetPlan: "STANDARD" | "PRO") => {
    try {
      const result = await scheduleDowngrade(targetPlan);
      if (result.changed) {
        toast.success(result.message ?? "Downgrade scheduled.");
      }
    } catch {
      toast.error("Failed to schedule downgrade. Please try again.");
    }
  };

  const handleUndoDowngrade = async () => {
    try {
      const result = await undoDowngrade();
      if (result.changed) {
        toast.success(result.message ?? "Downgrade cancelled.");
      }
    } catch {
      toast.error("Failed to undo downgrade. Please try again.");
    }
  };

  const handleCancelRenewal = async () => {
    setConfirmingCancel(true);
  };

  const confirmCancelSubscription = async () => {
    try {
      const result = await cancel();
      if (result.changed) {
        toast.success(result.message ?? "Subscription cancelled.");
      }
    } catch {
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setConfirmingCancel(false);
    }
  };

  function getCtaState(planId: "FREE" | "STANDARD" | "PRO"): {
    label: string;
    variant: CtaVariant;
    disabled: boolean;
  } {
    // Truly dead (past grace period)
    if (
      usage?.status === "CANCELLED" &&
      usage?.periodEnd &&
      new Date() >= new Date(usage.periodEnd)
    ) {
      if (planId === "FREE")
        return { label: "Current Plan", variant: "current", disabled: true };
      return { label: "Subscribe", variant: "subscribe", disabled: false };
    }

    // Grace period (cancelled but still has access)
    if (isInGracePeriod) {
      if (planId === "FREE")
        return {
          label: `Expired${periodEnd ? ` ${periodEnd}` : ""} — resubscribe`,
          variant: "expired",
          disabled: false,
        };
      return { label: "Subscribe", variant: "subscribe", disabled: false };
    }

    // Payment pending — show only on the plan the user is checking out for
    if (["CREATED", "PENDING"].includes(usage?.status ?? "")) {
      if (planId === "FREE")
        return { label: "—", variant: "noop", disabled: true };
      if (planId === usage?.pendingPlanId)
        return { label: "Payment pending…", variant: "noop", disabled: true };
      return { label: "Subscribe", variant: "subscribe", disabled: false };
    }

    // Active subscription states
    if (currentPlan === planId && !scheduledPlan) {
      return { label: "Current Plan", variant: "current", disabled: true };
    }

    if (planId === "FREE") {
      if (["STANDARD", "PRO"].includes(currentPlan)) {
        return {
          label: `Cancel renewal · active until ${periodEnd ?? "period end"}`,
          variant: "cancel_renewal",
          disabled: false,
        };
      }
      return { label: "Current Plan", variant: "current", disabled: true };
    }

    if (planId === "STANDARD") {
      if (currentPlan === "FREE") {
        return {
          label: "Subscribe ₹1,499/mo",
          variant: "subscribe",
          disabled: false,
        };
      }
      if (currentPlan === "STANDARD") {
        return { label: "Current Plan", variant: "current", disabled: true };
      }
      if (currentPlan === "PRO" && scheduledPlan === "STANDARD") {
        return {
          label: "Undo downgrade",
          variant: "undo_downgrade",
          disabled: false,
        };
      }
      if (currentPlan === "PRO") {
        return {
          label: `Schedule downgrade on ${periodEnd ?? "period end"}`,
          variant: "schedule_downgrade",
          disabled: false,
        };
      }
    }

    if (planId === "PRO") {
      if (currentPlan === "FREE") {
        return {
          label: "Subscribe ₹3,999/mo",
          variant: "subscribe",
          disabled: false,
        };
      }
      if (currentPlan === "STANDARD") {
        return { label: "Upgrade now", variant: "upgrade", disabled: false };
      }
      if (currentPlan === "PRO") {
        return { label: "Current Plan", variant: "current", disabled: true };
      }
    }

    return { label: "—", variant: "noop", disabled: true };
  }

  async function executeCta(
    planId: "FREE" | "STANDARD" | "PRO",
    variant: CtaVariant,
  ) {
    if (variant === "current" || variant === "noop") return;
    if (variant === "cancel_renewal") {
      await handleCancelRenewal();
      return;
    }
    if (variant === "undo_downgrade") {
      await handleUndoDowngrade();
      return;
    }
    if (variant === "expired") {
      // Free card during grace period — nothing to do on Free, just close
      return;
    }
    if (variant === "subscribe") {
      if (planId === "FREE") return;
      await handleSubscribeOrChange(planId);
      return;
    }
    if (variant === "upgrade") {
      await handleSubscribeOrChange(planId);
      return;
    }
    if (variant === "schedule_downgrade") {
      if (planId === "FREE") return;
      await handleScheduleDowngrade(planId);
      return;
    }
  }

  const freeCta = getCtaState("FREE");
  const standardCta = getCtaState("STANDARD");
  const proCta = getCtaState("PRO");

  if (usageLoading) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} direction="right">
        <DrawerContent className="dark bg-[#0f0f0f] border-l border-white/8 w-full! sm:max-w-4xl! h-full mt-0 rounded-none">
          <DrawerHeader className="border-b border-white/8 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle className="text-white text-xl font-bold tracking-tight">
                  Choose Your Plan
                </DrawerTitle>
                <DrawerDescription className="text-white/50 mt-1 text-sm">
                  Loading...
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleOpenChange(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="size-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="grid gap-4 p-6 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/8 bg-[#1a1a1a] p-5"
              >
                <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-4 h-8 w-28 animate-pulse rounded bg-white/10" />
                <div className="mt-6 space-y-3">
                  {[0, 1, 2, 3].map((line) => (
                    <div
                      key={line}
                      className="h-3 w-full animate-pulse rounded bg-white/8"
                    />
                  ))}
                </div>
                <div className="mt-8 h-10 w-full animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="right">
      <DrawerContent className="dark bg-[#0f0f0f] border-l border-white/8 w-full! sm:max-w-4xl! h-full mt-0 rounded-none">
        <DrawerHeader className="border-b border-white/8 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <DrawerTitle className="text-white text-xl font-bold tracking-tight">
                Choose Your Plan
              </DrawerTitle>
              <DrawerDescription className="text-white/50 mt-1 text-sm">
                {usageLoading ? (
                  "Loading..."
                ) : (
                  <>
                    Currently on{" "}
                    <span className="text-white font-medium">
                      {usage?.planDisplayName ?? "Free"}
                    </span>
                    {usage?.generationLimit !== -1 &&
                      usage?.generationsUsed !== undefined && (
                        <>
                          {" "}
                          · {usage.generationsUsed}/{usage.generationLimit} gens
                          this month
                        </>
                      )}
                  </>
                )}
              </DrawerDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              className="text-white/40 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Quota exceeded banner */}
          {usage?.generationsRemaining === 0 && usage?.planId !== "PRO" && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-amber-300/80">
                You&apos;ve used all {usage.generationLimit} generations this
                month.{" "}
                <span className="underline underline-offset-2">
                  Upgrade for more
                </span>
              </p>
            </div>
          )}

          {/* Scheduled change banner */}
          {scheduledPlan && (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-amber-300/80">
                Your plan will change to {scheduledPlan} on{" "}
                {periodEnd ?? "your next billing date"}.{" "}
                <button
                  onClick={handleUndoDowngrade}
                  disabled={undoing}
                  className="underline underline-offset-2 hover:text-amber-200"
                >
                  {undoing ? "Undoing..." : "Undo"}
                </button>
              </p>
            </div>
          )}

          {/* Checkout state banners */}
          {(checkoutState === "verifying" || checkoutState === "polling") && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-blue-400" />
              <p className="text-sm text-blue-300/80">
                Waiting for payment confirmation… This usually takes a few
                seconds.
              </p>
            </div>
          )}
          {checkoutState === "timeout" && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-amber-300/80">
                Payment confirmation is taking longer than expected. Please
                refresh the page or check your email for updates.
              </p>
            </div>
          )}
          {checkoutState === "failed" && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-sm text-red-300/80">
                Payment failed. Please try again or use a different payment
                method.
              </p>
            </div>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  id: "FREE" as const,
                  name: "Free",
                  price: "₹0",
                  period: "",
                  cta: freeCta,
                  accent: "border-white/[0.08]",
                },
                {
                  id: "STANDARD" as const,
                  name: "Standard",
                  price: "₹1,499",
                  period: "/mo",
                  cta: standardCta,
                  accent: "border-blue-500/30",
                },
                {
                  id: "PRO" as const,
                  name: "Pro",
                  price: "₹3,999",
                  period: "/mo",
                  cta: proCta,
                  accent: "border-amber-500/30",
                },
              ] as const
            ).map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-[#1a1a1a] p-4",
                  currentPlan === plan.id ? plan.accent : "border-white/6",
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    {plan.name}
                  </p>
                  {currentPlan === plan.id && !isInGracePeriod && (
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        plan.id === "PRO"
                          ? "bg-amber-500/15 text-amber-400"
                          : plan.id === "STANDARD"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-white/10 text-white/60",
                        mono.className,
                      )}
                    >
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-white/40">{plan.period}</span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {PLAN_FEATURES.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-2"
                    >
                      <FeatureValue
                        value={
                          feature[
                            plan.id.toLowerCase() as "free" | "standard" | "pro"
                          ]
                        }
                      />
                      <span className="text-[11px] text-white/50">
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Usage bar for current plan */}
                {usage?.planId === plan.id && usage.generationLimit > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-white/40">
                      <span>{usage.generationsUsed} used</span>
                      <span>{usage.generationsRemaining} remaining</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${Math.min(100, (usage.generationsUsed / usage.generationLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {confirmingCancel && plan.id === "FREE" ? (
                  <div className="mt-5 flex flex-col gap-2">
                    <p className="text-[10px] text-white/50 text-center leading-relaxed">
                      Your {currentPlan} access continues until{" "}
                      {periodEnd ?? "period end"}, then you&apos;ll switch to
                      Free.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={confirmCancelSubscription}
                        disabled={cancelling}
                        size="sm"
                        className={cn(
                          "flex-1 min-h-8 h-auto py-1.5 text-[10px] font-semibold border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 cursor-pointer",
                          mono.className,
                        )}
                      >
                        {cancelling ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Yes, cancel"
                        )}
                      </Button>
                      <Button
                        onClick={() => setConfirmingCancel(false)}
                        disabled={cancelling}
                        size="sm"
                        className={cn(
                          "flex-1 min-h-8 h-auto py-1.5 text-[10px] font-semibold border border-white/8 bg-transparent text-white/50 hover:bg-white/5 cursor-pointer",
                          mono.className,
                        )}
                      >
                        Keep plan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => executeCta(plan.id, plan.cta.variant)}
                    disabled={plan.cta.disabled || anyLoading}
                    size="sm"
                    className={cn(
                      "mt-5 min-h-9 h-auto w-full py-2 text-[10px] font-semibold leading-snug cursor-pointer whitespace-normal",
                      plan.cta.variant === "current"
                        ? "border border-white/8 bg-transparent text-white/30 cursor-default"
                        : plan.cta.variant === "upgrade"
                          ? "bg-amber-500 text-black hover:bg-amber-400"
                          : plan.cta.variant === "subscribe"
                            ? plan.id === "PRO"
                              ? "bg-amber-500 text-black hover:bg-amber-400"
                              : "bg-blue-500 text-white hover:bg-blue-400"
                            : plan.cta.variant === "cancel_renewal"
                              ? "border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
                              : plan.cta.variant === "schedule_downgrade"
                                ? "border border-white/8 bg-transparent text-white/60 hover:bg-white/5"
                                : plan.cta.variant === "undo_downgrade"
                                  ? "border border-emerald-500/30 bg-transparent text-emerald-400 hover:bg-emerald-500/10"
                                  : plan.cta.variant === "expired"
                                    ? "border border-amber-500/20 bg-transparent text-amber-300/70 hover:bg-amber-500/5"
                                    : "border border-white/8 bg-transparent text-white/30",
                      mono.className,
                    )}
                  >
                    {anyLoading && !plan.cta.disabled ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {plan.cta.label}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Upgrade note for STANDARD → PRO */}
          {currentPlan === "STANDARD" && !scheduledPlan && (
            <p className="mt-4 text-center text-xs text-white/35">
              Upgrading to Pro takes effect immediately with no extra charge
              this cycle.
            </p>
          )}

          {/* Downgrade note */}
          {currentPlan === "PRO" && !scheduledPlan && (
            <p className="mt-4 text-center text-xs text-white/35">
              Downgrades take effect at the end of your current billing period.
              You keep Pro access until then.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
