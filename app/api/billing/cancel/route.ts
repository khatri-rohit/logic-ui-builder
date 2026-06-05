import { NextRequest, NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.cancel.initiated",
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
        planId: true,
        status: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
      },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: true, message: "No active subscription found." },
        { status: 404 },
      );
    }

    const mutableStatuses = ["ACTIVE", "AUTHENTICATED"];
    if (!mutableStatuses.includes(subscription.status)) {
      return NextResponse.json(
        {
          error: true,
          code: "SUBSCRIPTION_NOT_MUTABLE",
          message: `Cannot cancel a subscription with status: ${subscription.status}. Please complete payment setup first.`,
        },
        { status: 409 },
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      return NextResponse.json({
        error: false,
        message: "Subscription is already scheduled for cancellation.",
        data: { planId: subscription.planId, changed: false },
      });
    }

    if (!subscription.razorpayPlanId) {
      return NextResponse.json(
        {
          error: true,
          message: "Razorpay plan ID not found for subscription.",
        },
        { status: 500 },
      );
    }

    try {
      await razorpay.subscriptions.cancel(
        subscription.razorpaySubscriptionId,
        true, // cancel_at_cycle_end = true
      );
    } catch (error) {
      logger.error("Error canceling Razorpay subscription: ", { error });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to cancel subscription.",
        },
        { status: 500 },
      );
    }

    // Immediately mark as cancelled in DB — do NOT wait for webhook.
    // Razorpay cancel() sets status to 'cancelled' immediately.
    // planId stays as-is until currentPeriodEnd passes; grace period is
    // computed in get-auth.ts from status + currentPeriodEnd.
    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        status: "CANCELLED",
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledChangeAt: null,
      },
    });

    const periodEndValid =
      subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd) > new Date();

    return NextResponse.json({
      error: false,
      message:
        `Subscription cancelled. You won't be charged again. Your ${subscription.planId} access continues until ${periodEndValid ? subscription.currentPeriodEnd!.toLocaleDateString("en-IN") : "the end of your billing period"}.`,
      data: { planId: subscription.planId, changed: true },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Error canceling subscription: ", { error });
    return NextResponse.json(
      {
        error: true,
        message: "Failed to cancel subscription.",
      },
      { status: 500 },
    );
  }
}
