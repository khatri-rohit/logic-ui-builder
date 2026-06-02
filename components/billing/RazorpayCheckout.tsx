"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    if (document.getElementById("razorpay-checkout-js")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.style.zIndex = "100000";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
}

export type CheckoutState =
  | "idle"
  | "opening"
  | "modal_open"
  | "payment_success" // handler fired
  | "verifying" // verify API call in flight
  | "polling" // waiting for webhook to flip CREATED -> ACTIVE
  | "active" // subscription.activated received
  | "cancelled" // user dismissed modal
  | "failed" // payment.failed from Razorpay
  | "timeout"; // polling exceeded 60s

interface UseRazorpayCheckoutOptions {
  email?: string;
  onClose?: () => void;
}

const POLL_DELAYS = [3000, 6000, 12000, 24000]; // ms
const POLL_TIMEOUT = 60000; // total polling budget

export function useRazorpayCheckout({
  email,
  onClose,
}: UseRazorpayCheckoutOptions = {}) {
  const queryClient = useQueryClient();
  const instanceRef = useRef<InstanceType<typeof window.Razorpay> | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);
  const pollIndexRef = useRef<number>(0);
  const dismissWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<boolean>(false);

  const clearAllTimers = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    if (dismissWaitRef.current) {
      clearTimeout(dismissWaitRef.current);
      dismissWaitRef.current = null;
    }
    abortRef.current = true;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      instanceRef.current?.close();
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const pollForActivation = useCallback(
    async (subscriptionId: string) => {
      if (abortRef.current) return;

      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_TIMEOUT) {
        setCheckoutState("timeout");
        toast.error(
          "Payment confirmation is taking longer than expected. Please refresh the page or check your email.",
          { duration: 8000 },
        );
        return;
      }

      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        if (!res.ok) throw new Error("Usage fetch failed");
        const payload = (await res.json()) as {
          error: boolean;
          data?: {
            status: string;
            razorpaySubscriptionId: string | null;
          };
        };

        const data = payload.data;
        if (
          data?.status === "ACTIVE" &&
          data?.razorpaySubscriptionId === subscriptionId
        ) {
          setCheckoutState("active");
          await queryClient.invalidateQueries({
            queryKey: billingKeys.all,
          });
          toast.success("Subscription activated! Your plan is now live.");
          onClose?.();
          return;
        }
      } catch (err) {
        logger.warn("Activation poll failed", { err });
      }

      const delay =
        POLL_DELAYS[Math.min(pollIndexRef.current, POLL_DELAYS.length - 1)];
      pollIndexRef.current += 1;
      pollingRef.current = setTimeout(
        () => pollForActivation(subscriptionId),
        delay,
      );
    },
    [queryClient, onClose],
  );

  const openCheckout = useCallback(
    async (subscriptionId: string, razorpayKeyId: string) => {
      // Reset state machine
      clearAllTimers();
      abortRef.current = false;
      setCheckoutState("opening");

      try {
        await loadRazorpayScript();
      } catch {
        setCheckoutState("idle");
        toast.error(
          "Could not load payment module. Please check your connection.",
        );
        return;
      }

      setCheckoutState("modal_open");

      const options: RazorpayOptions = {
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: "LOGIC",
        description: "UI/UX Builder Subscription",
        image: "/logo.png",
        prefill: {
          email: email ?? "",
        },
        theme: {
          color: "#124af0",
        },
        modal: {
          escape: false,
          ondismiss: () => {
            // Webhooks often arrive within 200-800ms after modal close.
            // Wait 500ms before declaring "cancelled" so polling can catch it.
            dismissWaitRef.current = setTimeout(() => {
              if (abortRef.current) return;
              setCheckoutState("cancelled");
              toast(
                "Payment cancelled. You can resume anytime from your account.",
              );
              onClose?.();
            }, 500);
          },
        },
        handler: async (response: RazorpayResponse) => {
          // Cancel the dismiss wait — handler fired means payment succeeded
          if (dismissWaitRef.current) {
            clearTimeout(dismissWaitRef.current);
            dismissWaitRef.current = null;
          }
          setCheckoutState("payment_success");

          try {
            setCheckoutState("verifying");
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
              setCheckoutState("failed");
              toast.error(
                "Payment verification failed. Contact support if the amount was charged.",
              );
              return;
            }

            // Payment verified. Start polling for webhook activation.
            setCheckoutState("polling");
            pollStartRef.current = Date.now();
            pollIndexRef.current = 0;
            await pollForActivation(response.razorpay_subscription_id);
          } catch {
            setCheckoutState("failed");
            toast.error("Could not verify payment. Please contact support.");
          }
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        setCheckoutState("failed");
        toast.error(
          `Payment failed: ${response.error.description ?? "Unknown error"}. Please try again.`,
        );
      });

      instanceRef.current = rzp;
      rzp.open();
    },
    [email, onClose, clearAllTimers, pollForActivation],
  );

  const resetCheckout = useCallback(() => {
    clearAllTimers();
    setCheckoutState("idle");
  }, [clearAllTimers]);

  return { openCheckout, checkoutState, resetCheckout };
}
