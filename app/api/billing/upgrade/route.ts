import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { getPlanConfig, PlanId } from "@/lib/plans";
import logger from "@/lib/logger";

const bodySchema = z.object({
  targetPlanId: z.enum(["STANDARD", "PRO"]),
});

export const runtime = "nodejs";

function isUpgrade(current: PlanId, target: PlanId): boolean {
  const rank: Record<PlanId, number> = { FREE: 0, STANDARD: 1, PRO: 2 };
  return rank[target] > rank[current];
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.upgrade.initiated",
    });

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: true, message: "Invalid target plan." },
        { status: 400 },
      );
    }

    const { targetPlanId } = body.data;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        planId: true,
        status: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
        cancelAtPeriodEnd: true,
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
          message: `Cannot upgrade a subscription with status: ${subscription.status}. Please complete payment setup first.`,
        },
        { status: 409 },
      );
    }

    const currentPlanId = subscription.planId as PlanId;

    if (!isUpgrade(currentPlanId, targetPlanId)) {
      return NextResponse.json(
        { error: true, message: "Target plan is not an upgrade." },
        { status: 400 },
      );
    }

    const targetConfig = getPlanConfig(targetPlanId);
    if (!targetConfig.razorpayPlanId) {
      return NextResponse.json(
        { error: true, message: "Target plan not configured in Razorpay." },
        { status: 500 },
      );
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: { scheduledPlanId: targetPlanId },
    });

    try {
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        plan_id: targetConfig.razorpayPlanId,
        quantity: 1,
        schedule_change_at: "now",
      });
    } catch (razorpayError) {
      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: { scheduledPlanId: null },
      });
      logger.error("Razorpay subscription upgrade failed", { razorpayError });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to upgrade subscription with payment provider.",
        },
        { status: 502 },
      );
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        planId: targetPlanId,
        razorpayPlanId: targetConfig.razorpayPlanId,
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelledAt: null,
      },
    });

    logger.info("Subscription upgraded immediately", {
      userId: authContext.appUserId,
      from: currentPlanId,
      to: targetPlanId,
    });

    return NextResponse.json({
      error: false,
      data: {
        message: `Upgraded to ${targetConfig.displayName} immediately. Your card will be charged now.`,
        planId: targetPlanId,
        changed: true,
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Upgrade failed", { error });
    return NextResponse.json(
      { error: true, message: "Upgrade failed. Please try again." },
      { status: 500 },
    );
  }
}
