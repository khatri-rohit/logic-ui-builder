"use client";
import { useState } from "react";
import { useUsageQuery } from "@/lib/billing/queries";
import { Button } from "@/components/ui/button";
import { PricingModal } from "../dashboard/PricingModal";

export function BillingPageClient() {
  const { data: usage, isLoading } = useUsageQuery();
  const [showPricing, setShowPricing] = useState(false);

  if (isLoading) return <p>Loading...</p>;

  const periodEnd = usage?.currentPeriodEnd
    ? new Date(usage.currentPeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="dark min-h-screen bg-[#0f0f0f] px-8 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Billing</h1>

        <div className="mt-8 rounded-xl border border-white/8 bg-[#1a1a1a] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Current Plan
              </p>
              <p className="mt-1 text-2xl font-bold">
                {usage?.planDisplayName ?? "Free"}
              </p>
            </div>
            <Button onClick={() => setShowPricing(true)}>Change Plan</Button>
          </div>

          {usage?.planId !== "FREE" && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">Generations used</p>
                <p className="mt-1 text-lg font-semibold">
                  {usage?.generationLimit === -1
                    ? `${usage?.generationsUsed} (unlimited)`
                    : `${usage?.generationsUsed} / ${usage?.generationLimit}`}
                </p>
              </div>
              {periodEnd && (
                <div>
                  <p className="text-xs text-white/40">
                    {usage?.cancelAtPeriodEnd ? "Access until" : "Next billing"}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{periodEnd}</p>
                </div>
              )}
            </div>
          )}

          {(usage?.scheduledPlanId || usage?.cancelAtPeriodEnd) && (
            <p className="mt-4 text-sm text-amber-300/70">
              {usage?.cancelAtPeriodEnd && !usage?.scheduledPlanId
                ? `Subscription cancels on ${periodEnd}.`
                : `Plan changes to ${usage?.scheduledPlanId} on ${periodEnd}.`}
            </p>
          )}
        </div>

        <PricingModal open={showPricing} onOpenChange={setShowPricing} />
      </div>
    </div>
  );
}
