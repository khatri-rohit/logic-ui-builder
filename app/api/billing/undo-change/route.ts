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
        status: true,
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

    const mutableStatuses = ["ACTIVE", "AUTHENTICATED"];
    if (!mutableStatuses.includes(subscription.status)) {
      return NextResponse.json(
        {
          error: true,
          code: "SUBSCRIPTION_NOT_MUTABLE",
          message: `Cannot undo change on a subscription with status: ${subscription.status}. Please complete payment setup first.`,
        },
        { status: 409 },
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
    const _sub = await razorpay.subscriptions.fetch(
      subscription.razorpaySubscriptionId,
    );
    logger.info("Fetched subscription from Razorpay", { _sub });

    const user = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
    });
    logger.info("Fetched subscription from Prisma", { user });
    // Restore the current plan on Razorpay (clears the scheduled change)
    await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
      plan_id:
        currentConfig.razorpayPlanId ||
        subscription.razorpayPlanId ||
        undefined,
      quantity: 1,
      schedule_change_at: "now",
    });

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Error undoing plan change", { error });
    if (error?.error) {
      return NextResponse.json(
        {
          error: true,
          code: error.error?.code || "RAZORPAY_ERROR",
          message: error.error?.description || "Failed to undo plan change.",
        },
        { status: error?.statusCode || 500 },
      );
    }
    return NextResponse.json(
      { error: true, message: "Failed to undo plan change." },
      { status: 500 },
    );
  }
}
