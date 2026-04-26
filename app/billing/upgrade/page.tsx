import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BillingUpgradeClient } from "@/components/billing/BillingUpgradeClient";

export const metadata: Metadata = {
  title: "Upgrade Plan",
  robots: { index: false, follow: false },
};

export default async function BillingUpgradePage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");
  return <BillingUpgradeClient />;
}
