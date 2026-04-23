"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCreateSubscriptionMutation } from "@/lib/billing/queries";
import { cn } from "@/lib/utils";

interface CheckoutButtonProps {
  planId: "FREE" | "STANDARD" | "PRO";
  label: string;
  className?: string;
}

export function CheckoutButton({
  planId,
  label,
  className,
}: CheckoutButtonProps) {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateSubscriptionMutation();

  const handleClick = async () => {
    try {
      const data = await mutateAsync(planId);
      // Redirect to Razorpay hosted checkout
      if (data.shortUrl) {
        router.push(data.shortUrl);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className={cn(className, "py-5!")}
    >
      {isPending ? "Redirecting to payment..." : label}
    </Button>
  );
}
