/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { getPlanConfig } from "@/lib/plans";
import logger from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.plan.change.undone",
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        planId: true,
        razorpaySubscriptionId: true,
        cancelAtPeriodEnd: true,
        scheduledPlanId: true,
        razorpayPlanId: true,
      },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: true, message: "No active subscription." },
        { status: 404 },
      );
    }

    const hasScheduledChange =
      subscription.scheduledPlanId || subscription.cancelAtPeriodEnd;
    if (!hasScheduledChange) {
      return NextResponse.json({
        error: false,
        message: "No scheduled change to undo.",
        data: { changed: false },
      });
    }

    const currentConfig = getPlanConfig(subscription.planId);

    // Restore the current plan on Razorpay (clears the scheduled change)
    await (razorpay.subscriptions as Record<string, Function>).update(
      subscription.razorpaySubscriptionId,
      {
        plan_id: currentConfig.razorpayPlanId ?? subscription.razorpayPlanId,
        quantity: 1,
        remaining_count: 0,
        schedule_change_at: "now",
      },
    );

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledChangeAt: null,
      },
    });

    logger.info("Scheduled plan change undone", {
      userId: authContext.appUserId,
    });

    return NextResponse.json({
      error: false,
      message:
        "Your plan change has been cancelled. Your subscription continues as normal.",
      data: { planId: subscription.planId, changed: true },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: true, message: "Failed to undo plan change." },
      { status: 500 },
    );
  }
}
