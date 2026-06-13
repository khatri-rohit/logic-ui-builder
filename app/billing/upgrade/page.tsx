import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UpgradePageClient } from "@/components/billing/UpgradePageClient";

export const metadata: Metadata = {
  title: "Upgrade Plan",
  robots: { index: false, follow: false },
};

export default async function BillingUpgradePage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");
  return <UpgradePageClient />;
}
