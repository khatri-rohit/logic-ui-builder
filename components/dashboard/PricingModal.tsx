"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { useRouter } from "next/navigation";
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
  useSubscribeMutation,
  useChangePlanMutation,
  useUndoPlanChangeMutation,
} from "@/lib/billing/queries";

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
  | "downgrade"
  | "cancel"
  | "scheduled"
  | "reactivate"
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
  {
    label: "Generation rollover",
    free: false,
    standard: false,
    pro: "Up to 50",
  },
  { label: "Support", free: "Community", standard: "Email", pro: "Priority" },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false) return <X className="size-3.5 text-white/25" />;
  if (value === true) return <Check className="size-3.5 text-emerald-400" />;
  return <span className="text-xs text-white/70">{value}</span>;
}

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const router = useRouter();
  const { data: usage, isLoading: usageLoading } = useUsageQuery();
  const {
    mutateAsync: subscribe,
    isPending: subscribing,
    isIdle: subscribeIdle,
  } = useSubscribeMutation();
  const {
    mutateAsync: changePlan,
    isPending: changing,
    isIdle: changePlanIdle,
  } = useChangePlanMutation();
  const { mutateAsync: undoChange, isPending: undoing } =
    useUndoPlanChangeMutation();

  const [loading, setLoading] = useState(false);

  const anyLoading = subscribing || changing || undoing;
  const currentPlan = usage?.planId ?? "FREE";
  const scheduledPlan = usage?.scheduledPlanId;
  const cancelAtPeriodEnd = usage?.cancelAtPeriodEnd ?? false;
  const periodEnd = usage?.currentPeriodEnd
    ? new Date(usage.currentPeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const handleFreePlanCta = async () => {
    // FREE plan CTA when on paid plan = cancel
    if (currentPlan === "FREE") return; // already free, no-op
    try {
      const result = await changePlan("FREE");
      toast.success(result.message ?? "Cancellation scheduled.");
    } catch {
      toast.error("Failed to schedule cancellation. Please try again.");
    }
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).Razorpay) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleSubscribeOrChange = async (targetPlan: "STANDARD" | "PRO") => {
    // FREE user: go through checkout
    if (currentPlan === "FREE") {
      try {
        const data = await subscribe(targetPlan);

        const loaded = await loadRazorpay();
        if (!loaded) {
          toast.error("Razorpay SDK failed to load");
          return;
        }

        const options = {
          key: data.razorpayKeyId,
          subscription_id: data.subscriptionId,

          name: "LOGIC UI/UX",
          description: `${targetPlan} Plan Subscription`,

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handler: function (response: any) {
            // Payment completed (NOT final truth)
            setLoading(true);
          },

          modal: {
            ondismiss: function () {
              setLoading(false);
              console.log("Checkout closed");
            },
          },

          theme: {
            color: "#0f0f0f",
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();

        setLoading(false);
        onOpenChange(false);
        if (data.shortUrl) router.push(data.shortUrl);
      } catch {
        toast.error("Failed to start checkout. Please try again.");
      }
      return;
    }

    // Paid user: use change-plan
    try {
      const result = await changePlan(targetPlan);
      if (result.changed) {
        toast.success(result.message ?? "Plan updated.");
      }
    } catch {
      toast.error("Failed to change plan. Please try again.");
    }
  };

  const handleUndoChange = async () => {
    try {
      await undoChange();
      toast.success(
        "Scheduled change cancelled. Your plan continues as normal.",
      );
    } catch {
      toast.error("Failed to undo change. Please try again.");
    }
  };

  function getCtaState(planId: "FREE" | "STANDARD" | "PRO"): {
    label: string;
    variant: CtaVariant;
    disabled: boolean;
  } {
    if (currentPlan === planId && !scheduledPlan && !cancelAtPeriodEnd) {
      return { label: "Current Plan", variant: "current", disabled: true };
    }

    if (planId === "FREE") {
      if (cancelAtPeriodEnd) {
        return {
          label: `Cancels ${periodEnd ?? "at period end"}`,
          variant: "scheduled",
          disabled: false,
        };
      }
      if (currentPlan === "FREE") {
        return { label: "Current Plan", variant: "current", disabled: true };
      }
      return {
        label: "Cancel subscription",
        variant: "cancel",
        disabled: false,
      };
    }

    if (planId === "STANDARD") {
      if (currentPlan === "FREE") {
        return {
          label: "Subscribe ₹1,499/mo",
          variant: "subscribe",
          disabled: false,
        };
      }
      if (currentPlan === "STANDARD" && cancelAtPeriodEnd) {
        return {
          label: `Reactivate (cancels ${periodEnd})`,
          variant: "reactivate",
          disabled: false,
        };
      }
      if (currentPlan === "PRO" && scheduledPlan === "STANDARD") {
        return {
          label: `Scheduled ${periodEnd ?? ""}`,
          variant: "scheduled",
          disabled: false,
        };
      }
      if (currentPlan === "PRO") {
        return { label: "Downgrade", variant: "downgrade", disabled: false };
      }
      return { label: "Current Plan", variant: "current", disabled: true };
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
        return {
          label: "Upgrade — free switch",
          variant: "upgrade",
          disabled: false,
        };
      }
      if (currentPlan === "PRO" && cancelAtPeriodEnd) {
        return {
          label: `Reactivate (cancels ${periodEnd})`,
          variant: "reactivate",
          disabled: false,
        };
      }
      return { label: "Current Plan", variant: "current", disabled: true };
    }

    return { label: "—", variant: "noop", disabled: true };
  }

  async function executeCta(
    planId: "FREE" | "STANDARD" | "PRO",
    variant: CtaVariant,
  ) {
    if (variant === "current" || variant === "noop") return;
    if (variant === "scheduled") {
      await handleUndoChange();
      return;
    }
    if (variant === "reactivate") {
      await handleUndoChange();
      return;
    }
    if (variant === "cancel") {
      await handleFreePlanCta();
      return;
    }
    if (planId === "FREE") return;
    await handleSubscribeOrChange(planId);
  }

  const freeCta = getCtaState("FREE");
  const standardCta = getCtaState("STANDARD");
  const proCta = getCtaState("PRO");

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
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
              onClick={() => onOpenChange(false)}
              className="text-white/40 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Scheduled change banner */}
          {(scheduledPlan || cancelAtPeriodEnd) && (
            <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-amber-300/80">
                {cancelAtPeriodEnd && !scheduledPlan
                  ? `Your subscription cancels on ${periodEnd ?? "your next billing date"}.`
                  : `Downgrade to ${scheduledPlan} scheduled for ${periodEnd ?? "your next billing date"}.`}{" "}
                <button
                  onClick={handleUndoChange}
                  disabled={undoing}
                  className="underline underline-offset-2 hover:text-amber-200"
                >
                  {undoing ? "Undoing..." : "Undo"}
                </button>
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
                  {currentPlan === plan.id && (
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

                <Button
                  onClick={() => executeCta(plan.id, plan.cta.variant)}
                  disabled={
                    plan.cta.disabled ||
                    anyLoading ||
                    loading ||
                    subscribeIdle ||
                    changePlanIdle
                  }
                  size="sm"
                  className={cn(
                    "mt-5 h-9 w-full text-xs font-semibold",
                    plan.cta.variant === "current"
                      ? "border border-white/8 bg-transparent text-white/30 cursor-default"
                      : plan.cta.variant === "upgrade"
                        ? "bg-amber-500 text-black hover:bg-amber-400"
                        : plan.cta.variant === "subscribe"
                          ? plan.id === "PRO"
                            ? "bg-amber-500 text-black hover:bg-amber-400"
                            : "bg-blue-500 text-white hover:bg-blue-400"
                          : plan.cta.variant === "cancel"
                            ? "border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
                            : plan.cta.variant === "downgrade"
                              ? "border border-white/8 bg-transparent text-white/60 hover:bg-white/5"
                              : plan.cta.variant === "scheduled"
                                ? "border border-amber-500/20 bg-transparent text-amber-300/70 hover:bg-amber-500/5"
                                : plan.cta.variant === "reactivate"
                                  ? "border border-emerald-500/30 bg-transparent text-emerald-400 hover:bg-emerald-500/10"
                                  : "border border-white/8 bg-transparent text-white/30",
                    mono.className,
                  )}
                >
                  {anyLoading && !plan.cta.disabled ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {plan.cta.label}
                </Button>
              </div>
            ))}
          </div>

          {/* Upgrade note for STANDARD → PRO */}
          {currentPlan === "STANDARD" && (
            <p className="mt-4 text-center text-xs text-white/35">
              Upgrading to Pro takes effect immediately with no extra charge
              this cycle.
            </p>
          )}

          {/* Downgrade note */}
          {currentPlan === "PRO" && (
            <p className="mt-4 text-center text-xs text-white/35">
              Downgrades take effect at the end of your current billing period.
              You keep Pro access until then.
            </p>
          )}
        </div>
        {loading && (
          <div className="h-screen flex items-center justify-center bg-black text-white">
            <div className="text-center space-y-3">
              <p className="text-sm text-white/60">
                Processing your subscription...
              </p>
              <div className="animate-spin h-5 w-5 border border-white/20 border-t-white rounded-full mx-auto" />
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
