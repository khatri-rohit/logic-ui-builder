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

function isDowngrade(current: PlanId, target: PlanId): boolean {
  const rank: Record<PlanId, number> = { FREE: 0, STANDARD: 1, PRO: 2 };
  return rank[target] < rank[current];
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.schedule_downgrade.initiated",
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
        currentPeriodEnd: true,
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
          message: `Cannot change plan on a subscription with status: ${subscription.status}. Please complete payment setup first.`,
        },
        { status: 409 },
      );
    }

    const currentPlanId = subscription.planId as PlanId;

    if (!isDowngrade(currentPlanId, targetPlanId)) {
      return NextResponse.json(
        { error: true, message: "Target plan is not a downgrade." },
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

    if (subscription.scheduledPlanId === targetPlanId) {
      return NextResponse.json({
        error: false,
        message: `Downgrade to ${targetConfig.displayName} is already scheduled.`,
        data: {
          planId: currentPlanId,
          scheduledPlanId: targetPlanId,
          changed: false,
        },
      });
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: { scheduledPlanId: targetPlanId },
    });

    try {
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        plan_id: targetConfig.razorpayPlanId,
        quantity: 1,
        schedule_change_at: "cycle_end",
      });
    } catch (razorpayError) {
      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: { scheduledPlanId: null },
      });
      logger.error("Razorpay subscription downgrade failed", { razorpayError });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to schedule downgrade with payment provider.",
        },
        { status: 502 },
      );
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        scheduledPlanId: targetPlanId,
        scheduledChangeAt: subscription.currentPeriodEnd,
        razorpayPlanId: targetConfig.razorpayPlanId,
      },
    });

    logger.info("Subscription downgrade scheduled", {
      userId: authContext.appUserId,
      from: currentPlanId,
      to: targetPlanId,
      effectiveAt: subscription.currentPeriodEnd,
    });

    return NextResponse.json({
      error: false,
      data: {
        planId: currentPlanId,
        scheduledPlanId: targetPlanId,
        scheduledChangeAt: subscription.currentPeriodEnd?.toISOString() ?? null,
        changed: true,
        message: `Your plan will change to ${targetConfig.displayName} on ${subscription.currentPeriodEnd?.toLocaleDateString("en-IN") ?? "your next billing date"}. You keep ${currentPlanId} access until then.`,
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Schedule downgrade failed", { error });
    return NextResponse.json(
      { error: true, message: "Failed to schedule downgrade. Please try again." },
      { status: 500 },
    );
  }
}
