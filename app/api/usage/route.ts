import { NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getOrCreateUsagePeriod } from "@/lib/usage";
import { getPlanConfig } from "@/lib/plans";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "usage.checked",
    });
    const usage = await getOrCreateUsagePeriod(authContext.appUserId);
    if (!usage)
      return NextResponse.json(
        { error: true, message: "Usage unavailable" },
        { status: 503 },
      );

    const planConfig = getPlanConfig(authContext.effectivePlanId);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        scheduledPlanId: true,
        scheduledChangeAt: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        razorpaySubscriptionId: true,
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
        // In the GET /api/usage response data object, add:
        scheduledPlanId: subscription.scheduledPlanId ?? null,
        scheduledChangeAt:
          subscription.scheduledChangeAt?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId ?? null,
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
