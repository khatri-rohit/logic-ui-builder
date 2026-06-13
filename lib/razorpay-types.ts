import type { INormalizeError } from "razorpay/dist/types/api";
import type { Subscriptions } from "razorpay/dist/types/subscriptions";
import type { Plans } from "razorpay/dist/types/plans";
import type { Payments } from "razorpay/dist/types/payments";
import type { Invoices } from "razorpay/dist/types/invoices";
import type { Customers } from "razorpay/dist/types/customers";

export type { INormalizeError, Subscriptions, Plans, Payments, Invoices, Customers };

export function isRazorpayError(error: unknown): error is INormalizeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    "error" in error &&
    typeof (error as Record<string, unknown>).error === "object"
  );
}
