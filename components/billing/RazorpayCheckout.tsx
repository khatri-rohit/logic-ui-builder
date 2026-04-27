"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { billingKeys } from "@/lib/billing/queries";
import logger from "@/lib/logger";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: { color?: string };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
  };
  handler: (response: RazorpayResponse) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
      on: (
        event: string,
        handler: (response: { error: { description: string } }) => void,
      ) => void;
    };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Avoid loading twice
    if (document.getElementById("razorpay-checkout-js")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.style.zIndex = "100000"; // ensure it appears above other modals
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
}

interface UseRazorpayCheckoutOptions {
  email?: string;
  onClose?: () => void;
}

export function useRazorpayCheckout({
  email,
  onClose,
}: UseRazorpayCheckoutOptions = {}) {
  const queryClient = useQueryClient();
  const instanceRef = useRef<InstanceType<typeof window.Razorpay> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      instanceRef.current?.close();
    };
  }, []);

  const openCheckout = async (
    subscriptionId: string,
    razorpayKeyId: string,
  ) => {
    try {
      await loadRazorpayScript();
    } catch {
      toast.error(
        "Could not load payment module. Please check your connection.",
      );
      return;
    }

    const options: RazorpayOptions = {
      key: razorpayKeyId,
      subscription_id: subscriptionId,
      name: "LOGIC",
      description: "UI/UX Builder Subscription",
      image: "/logo.png", // optional — path to your logo in /public
      prefill: {
        email: email ?? "",
      },
      theme: {
        color: "#124af0",
      },
      modal: {
        escape: false, // prevent accidental dismissal
        ondismiss: () => {
          onClose?.();
          toast("Payment cancelled. You can resume anytime from your account.");
        },
      },
      handler: async (response: RazorpayResponse) => {
        // Verify payment signature server-side
        try {
          const res = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          const data = (await res.json()) as {
            error: boolean;
            message?: string;
          };

          if (!res.ok || data.error) {
            toast.error(
              "Payment verification failed. Contact support if the amount was charged.",
            );
            return;
          }
          logger.info("Payment verified successfully", { res });
          // Invalidate billing cache so usage/plan badge refreshes
          await queryClient.invalidateQueries({ queryKey: billingKeys.all });

          toast.success("Subscription activated! Your plan is now live.");
          onClose?.();

          // Stay on the current page — no redirect needed
          // The plan badge in the header will update automatically via invalidation
          // If you want to route somewhere specific:
          // router.push('/');
        } catch {
          toast.error("Could not verify payment. Please contact support.");
        }
      },
    };

    const rzp = new window.Razorpay(options);

    // Handle payment failure events from the modal
    rzp.on("payment.failed", (response) => {
      toast.error(
        `Payment failed: ${response.error.description ?? "Unknown error"}. Please try again.`,
      );
    });

    instanceRef.current = rzp;
    rzp.open();
  };

  return { openCheckout };
}
