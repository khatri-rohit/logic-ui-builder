"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, XCircle } from "lucide-react";

import { billingKeys } from "@/lib/billing/queries";

function StatusPanel({
  status,
}: {
  status: "verifying" | "success" | "error";
}) {
  const Icon =
    status === "success" ? Check : status === "error" ? XCircle : Loader2;
  const title =
    status === "success"
      ? "Subscription active"
      : status === "error"
        ? "Verification failed"
        : "Verifying payment";
  const message =
    status === "success"
      ? "Your billing status has been updated. Redirecting to LOGIC."
      : status === "error"
        ? "Contact support if you were charged and your plan did not update."
        : "We are confirming the Razorpay payment response.";

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-[#111111] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#181818] p-6 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-white/10 bg-white/5">
          <Icon
            className={`size-5 ${
              status === "verifying" ? "animate-spin" : ""
            }`}
          />
        </div>
        <h1 className="mt-5 text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">{message}</p>
      </section>
    </main>
  );
}

function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );

  useEffect(() => {
    const paymentId = searchParams.get("razorpay_payment_id");
    const subscriptionId = searchParams.get("razorpay_subscription_id");
    const signature = searchParams.get("razorpay_signature");

    if (!paymentId || !subscriptionId || !signature) {
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
          window.setTimeout(() => router.replace("/"), 2000);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [searchParams, router, queryClient]);

  return <StatusPanel status={status} />;
}

export default function BillingSuccessPageWrapper() {
  return (
    <Suspense fallback={<StatusPanel status="verifying" />}>
      <BillingSuccessPage />
    </Suspense>
  );
}
