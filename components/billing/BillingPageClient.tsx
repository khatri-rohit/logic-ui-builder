"use client";
import { useState } from "react";
import { useUsageQuery, useInvoicesQuery, type Invoice } from "@/lib/billing/queries";
import { Button } from "@/components/ui/button";
import { PricingModal } from "../dashboard/PricingModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, formatDateRange, formatCurrency } from "@/lib/format";
import { Receipt, ExternalLink, Calendar, CreditCard } from "lucide-react";

export function BillingPageClient() {
  const { data: usage, isLoading } = useUsageQuery();
  const { data: invoices, isLoading: invoicesLoading } = useInvoicesQuery();
  const [showPricing, setShowPricing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-[#0f0f0f] px-8 py-12 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-32 animate-pulse rounded bg-white/10" />
          <div className="mt-8 rounded-xl border border-white/8 bg-[#1a1a1a] p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="h-8 w-40 animate-pulse rounded bg-white/10" />
              </div>
              <div className="h-10 w-28 animate-pulse rounded bg-white/10" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="h-16 animate-pulse rounded bg-white/5" />
              <div className="h-16 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const periodEnd = usage?.periodEnd
    ? formatDate(usage.periodEnd, { month: "long", year: true })
    : null;

  return (
    <div className="dark min-h-screen bg-[#0f0f0f] px-8 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Billing</h1>

        <div className="mt-8 rounded-xl border border-white/8 bg-[#1a1a1a] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Current Plan
              </p>
              <p className="mt-1 text-2xl font-bold">
                {usage?.planDisplayName ?? "Free"}
              </p>
            </div>
            <Button onClick={() => setShowPricing(true)}>Change Plan</Button>
          </div>

          {usage?.planId !== "FREE" && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">Generations used</p>
                <p className="mt-1 text-lg font-semibold">
                  {usage?.generationLimit === -1
                    ? `${usage?.generationsUsed} (unlimited)`
                    : `${usage?.generationsUsed} / ${usage?.generationLimit}`}
                </p>
              </div>
              {periodEnd && (
                <div>
                  <p className="text-xs text-white/40">
                    {usage?.cancelAtPeriodEnd ? "Access until" : "Next billing"}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{periodEnd}</p>
                </div>
              )}
            </div>
          )}

          {(usage?.scheduledPlanId || usage?.cancelAtPeriodEnd) && (
            <p className="mt-4 text-sm text-amber-300/70">
              {usage?.cancelAtPeriodEnd && !usage?.scheduledPlanId
                ? `Subscription cancels on ${periodEnd}.`
                : `Plan changes to ${usage?.scheduledPlanId} on ${periodEnd}.`}
            </p>
          )}
        </div>

        <PricingModal open={showPricing} onOpenChange={setShowPricing} />

        {/* Invoice History */}
        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5 text-white/60" />
            Invoice History
          </h2>

          {invoicesLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-white/5"
                />
              ))}
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="mt-4 space-y-3">
              {invoices.map((invoice) => {
                const paidDate = formatDate(invoice.paidAt, {
                  month: "short",
                  year: true,
                });
                const amountText = formatCurrency(
                  invoice.amount,
                  invoice.currency || "INR",
                );

                return (
                  <button
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/8 bg-[#1a1a1a] px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-white/40" />
                      <div>
                        <p className="text-sm font-medium">
                          {invoice.receipt || invoice.invoiceNumber || `Invoice ${invoice.razorpayInvoiceId.slice(-6)}`}
                        </p>
                        <p className="text-xs text-white/40">
                          {paidDate}
                          {invoice.periodStart && invoice.periodEnd
                            ? ` · ${formatDateRange(invoice.periodStart, invoice.periodEnd)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{amountText}</p>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        {invoice.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/40">
              No invoices yet. Invoices appear here after your subscription is charged.
            </p>
          )}
        </div>

        {/* Invoice Detail Modal */}
        <Dialog
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
        >
          <DialogContent className="border-white/8 bg-[#1a1a1a] text-white">
            {selectedInvoice && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <Receipt className="h-5 w-5 text-white/60" />
                    Invoice Details
                  </DialogTitle>
                  <DialogDescription className="text-white/40">
                    {selectedInvoice.razorpayInvoiceId}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/60">Amount</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(
                        selectedInvoice.amount,
                        selectedInvoice.currency || "INR",
                      )}
                    </span>
                  </div>

                  {selectedInvoice.description && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm text-white/60">Description</span>
                      <span className="text-sm">{selectedInvoice.description}</span>
                    </div>
                  )}

                  {selectedInvoice.periodStart && selectedInvoice.periodEnd && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm text-white/60">Billing Period</span>
                      <span className="text-sm">
                        {formatDateRange(
                          selectedInvoice.periodStart,
                          selectedInvoice.periodEnd,
                        )}
                      </span>
                    </div>
                  )}

                  {selectedInvoice.paidAt && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm text-white/60">Paid On</span>
                      <span className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-white/40" />
                        {formatDate(selectedInvoice.paidAt, {
                          month: "long",
                          year: true,
                        })}
                      </span>
                    </div>
                  )}

                  {selectedInvoice.receipt && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-sm text-white/60">Receipt Ref</span>
                      <span className="text-sm">{selectedInvoice.receipt}</span>
                    </div>
                  )}

                  {selectedInvoice.shortUrl && (
                    <a
                      href={selectedInvoice.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View on Razorpay
                    </a>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
