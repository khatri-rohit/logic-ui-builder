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
        cancelAtPeriodEnd: true,
      },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: true, message: "No active subscription found." },
        { status: 404 },
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

    // Keep current plan features until the actual cancellation date.
    // planId stays as-is; restriction happens via status + effectivePlanId.
    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
        scheduledPlanId: "FREE",
        scheduledChangeAt: null, // will be populated by webhook when cycle ends
      },
    });

    return NextResponse.json({
      error: false,
      message:
        "Subscription cancellation initiated. Your subscription is active until the end of the current billing period.",
      data: { planId: subscription.planId, scheduledPlanId: "FREE" },
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
