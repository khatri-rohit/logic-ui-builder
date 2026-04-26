import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BillingPageClient } from "@/components/billing/BillingPageClient";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");
  return <BillingPageClient />;
}
