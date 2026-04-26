"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useCancelSubscriptionMutation,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
} from "@/lib/billing/queries";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface CheckoutButtonProps {
  planId: "FREE" | "STANDARD" | "PRO";
  label: string;
  className?: string;
  subscribedPlan?: string;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export function CheckoutButton({
  planId,
  label,
  className,
  subscribedPlan,
  subscriptionStatus,
  cancelAtPeriodEnd,
}: CheckoutButtonProps) {
  const router = useRouter();
  const { mutateAsync: createMutateAsync, isPending } =
    useCreateSubscriptionMutation();
  const { mutateAsync: updateMutateAsync, isPending: isUpdating } =
    useUpdateSubscriptionMutation();
  const { mutateAsync: cancelMutateAsync } = useCancelSubscriptionMutation();

  const [showUpdgradeWarning, setShowUpdgradeWarning] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const isBusy = isPending || isUpdating;

  const handleClick = async () => {
    try {
      if (subscribedPlan && subscribedPlan === planId) {
        return;
      }

      if (subscribedPlan && subscribedPlan !== "FREE" && planId === "FREE") {
        setShowDowngradeWarning(true);
        return;
      }

      if (subscribedPlan && subscribedPlan !== "FREE") {
        setShowUpdgradeWarning(true);
        return;
      }

      const data = await createMutateAsync(planId);
      if (data.shortUrl) {
        router.push(data.shortUrl);
      }
      router.refresh();
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  const handleDowngrade = async () => {
    try {
      await cancelMutateAsync();
      setShowDowngradeWarning(false);
      router.refresh();
    } catch (err) {
      console.error("Downgrade failed:", err);
    }
  };

  const handleUpdate = async () => {
    try {
      const data = await updateMutateAsync(planId as "STANDARD" | "PRO");
      if (data.shortUrl) {
        router.push(data.shortUrl);
      }
      router.refresh();
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isBusy}
        className={cn(className, "py-5!")}
      >
        {isBusy ? "Processing..." : label}
      </Button>

      {/* Downgrade warning */}
      {showDowngradeWarning && (
        <Dialog
          open={showDowngradeWarning || showUpdgradeWarning}
          onOpenChange={
            showDowngradeWarning
              ? setShowDowngradeWarning
              : setShowUpdgradeWarning
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showDowngradeWarning ? "Downgrade Alert" : "Upgrade Alert"}
              </DialogTitle>
              <DialogDescription>
                {showUpdgradeWarning
                  ? "Upgrading your plan will immediately switch you to the new tier and billing will be adjusted accordingly. You will have access to the new features and limits of the selected plan right away."
                  : cancelAtPeriodEnd
                    ? "This subscription is already set to end at the current billing period."
                    : subscriptionStatus === "ACTIVE" ||
                        subscriptionStatus === "AUTHENTICATED"
                      ? "Downgrading to the free plan will keep your paid access active until the end of the current billing period. After that, billing will stop and your plan will move to Free."
                      : "Downgrading to the free plan will stop paid billing at the current period boundary."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDowngradeWarning(false);
                  setShowUpdgradeWarning(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={showUpdgradeWarning ? handleUpdate : handleDowngrade}
              >
                Confirm Cancellation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
