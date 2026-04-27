"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { billingKeys } from "@/lib/billing/queries";

// This page is the fallback for environments where Razorpay.js
// can't execute the handler function (e.g., mobile WebView).
// In normal desktop/mobile browser flow, the modal handler fires instead.
export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );

  useEffect(() => {
    // Razorpay POSTs params here in WebView fallback mode
    // They arrive as query params when callback_method is 'get',
    // or as POST body — check both
    const paymentId = searchParams.get("razorpay_payment_id");
    const subscriptionId = searchParams.get("razorpay_subscription_id");
    const signature = searchParams.get("razorpay_signature");

    if (!paymentId || !subscriptionId || !signature) {
      // No params — user probably navigated here directly
      router.replace("/");
      return;
    }

    fetch("/api/billing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: subscriptionId,
        razorpaySignature: signature,
      }),
    })
      .then((res) => res.json())
      .then(async (data: { error: boolean }) => {
        if (!data.error) {
          await queryClient.invalidateQueries({ queryKey: billingKeys.all });
          setStatus("success");
          setTimeout(() => router.replace("/"), 2000);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [searchParams, router, queryClient]);

  if (status === "verifying") return <p>Verifying payment...</p>;
  if (status === "success") return <p>Subscription active! Redirecting...</p>;
  return <p>Verification failed. Contact support if you were charged.</p>;
}
