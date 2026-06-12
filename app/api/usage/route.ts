import { NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getOrCreateUsagePeriod } from "@/lib/usage";
import { getPlanConfig } from "@/lib/plans";
import prisma from "@/lib/prisma";

function planFromRazorpayPlanId(
  razorpayPlanId: string | null,
): "FREE" | "STANDARD" | "PRO" | null {
  if (!razorpayPlanId) return null;
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_STANDARD) return "STANDARD";
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return "PRO";
  return null;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "usage.checked",
    });
    const usage = await getOrCreateUsagePeriod(
      authContext.appUserId,
      authContext.effectivePlanId,
    );
    if (!usage)
      return NextResponse.json(
        { error: true, message: "Usage unavailable" },
        { status: 503 },
      );

    const planConfig = getPlanConfig(authContext.effectivePlanId);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        status: true,
        scheduledPlanId: true,
        scheduledChangeAt: true,
        cancelAtPeriodEnd: true,
        razorpayPlanId: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: true, message: "Subscription not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      error: false,
      data: {
        planId: authContext.effectivePlanId,
        planDisplayName: planConfig.displayName,
        generationsUsed: usage.generationsUsed,
        generationLimit: usage.generationLimit,
        generationsRemaining: usage.generationsRemaining,
        projectsCreated: usage.projectsCreated,
        projectLimit: usage.projectLimit,
        projectsRemaining: usage.projectsRemaining,
        frameRegenerationEnabled: usage.frameRegenerationEnabled,
        periodStart: usage.periodStart.toISOString(),
        periodEnd: usage.periodEnd.toISOString(),
        status: subscription.status,
        scheduledPlanId: subscription.scheduledPlanId ?? null,
        scheduledChangeAt:
          subscription.scheduledChangeAt?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        pendingPlanId: planFromRazorpayPlanId(subscription.razorpayPlanId),
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: true, message: "Failed to fetch usage" },
      { status: 500 },
    );
  }
}
