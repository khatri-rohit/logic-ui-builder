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
      eventType: "billing.undo_downgrade.initiated",
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        planId: true,
        status: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
        scheduledPlanId: true,
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
          message: `Cannot undo downgrade on a subscription with status: ${subscription.status}.`,
        },
        { status: 409 },
      );
    }

    if (!subscription.scheduledPlanId) {
      return NextResponse.json({
        error: false,
        message: "No scheduled downgrade to undo.",
        data: { changed: false },
      });
    }

    const currentConfig = getPlanConfig(subscription.planId);

    try {
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        plan_id:
          currentConfig.razorpayPlanId ||
          subscription.razorpayPlanId ||
          undefined,
        quantity: 1,
        schedule_change_at: "now",
      });
    } catch (razorpayError) {
      logger.error("Razorpay undo downgrade failed", { razorpayError });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to undo downgrade with payment provider.",
        },
        { status: 502 },
      );
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
      },
    });

    logger.info("Scheduled downgrade undone", {
      userId: authContext.appUserId,
      planId: subscription.planId,
    });

    return NextResponse.json({
      error: false,
      message:
        "Downgrade cancelled. Your plan continues as normal.",
      data: { planId: subscription.planId, changed: true },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Undo downgrade failed", { error });
    return NextResponse.json(
      { error: true, message: "Failed to undo downgrade. Please try again." },
      { status: 500 },
    );
  }
}
