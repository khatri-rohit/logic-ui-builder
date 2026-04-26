"use client";
import { useState } from "react";
import { PricingModal } from "../dashboard/PricingModal";

export function BillingUpgradeClient() {
  // Force the drawer open and non-dismissible on this dedicated page
  const [open, setOpen] = useState(true);
  return <PricingModal open={open} onOpenChange={setOpen} />;
}
