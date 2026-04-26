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
      },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: true, message: "No active subscription found." },
        { status: 404 },
      );
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
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        customer_notify: 1,
        schedule_change_at: "cycle_end",
      });
    } catch (error) {
      logger.error("Error canceling Razorpay subscription: ", { error });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to cancel subscription.",
          details: error,
        },
        { status: 500 },
      );
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
        planId: "FREE",
        generationLimit: 10,
        projectLimit: 3,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      error: false,
      message:
        "Subscription cancellation initiated. Your subscription is active until the end of the current billing period.",
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
        details: error,
      },
      { status: 500 },
    );
  }
}
