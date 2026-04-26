/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { getPlanConfig, PlanId } from "@/lib/plans";
import logger from "@/lib/logger";

const bodySchema = z.object({
  targetPlanId: z.enum(["FREE", "STANDARD", "PRO"]),
});

export const runtime = "nodejs";

function isUpgrade(current: PlanId, target: PlanId): boolean {
  const rank: Record<PlanId, number> = { FREE: 0, STANDARD: 1, PRO: 2 };
  return rank[target] > rank[current];
}

function isDowngrade(current: PlanId, target: PlanId): boolean {
  const rank: Record<PlanId, number> = { FREE: 0, STANDARD: 1, PRO: 2 };
  return rank[target] < rank[current];
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.plan.change.initiated",
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
        id: true,
        planId: true,
        status: true,
        razorpaySubscriptionId: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        scheduledPlanId: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: true, message: "Subscription not found." },
        { status: 404 },
      );
    }

    const currentPlanId = subscription.planId as PlanId;

    // ── Guard: no-op if already on target plan ──────────────────────────────
    if (currentPlanId === targetPlanId && !subscription.scheduledPlanId) {
      return NextResponse.json({
        error: false,
        data: {
          message: "You are already on this plan.",
          planId: currentPlanId,
          changed: false,
        },
      });
    }

    // ── Guard: FREE → paid must go through /checkout (needs payment) ────────
    if (currentPlanId === "FREE" && targetPlanId !== "FREE") {
      return NextResponse.json(
        {
          error: true,
          code: "USE_CHECKOUT",
          message:
            "New subscriptions must be created through the checkout flow.",
          data: { checkoutUrl: "/api/billing/checkout" },
        },
        { status: 400 },
      );
    }

    // ── Guard: no active Razorpay subscription ───────────────────────────────
    if (!subscription.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: true, message: "No active Razorpay subscription found." },
        { status: 400 },
      );
    }

    // ── Guard: subscription must be in a mutable state ──────────────────────
    const mutableStatuses = ["ACTIVE", "AUTHENTICATED", "PENDING", "CREATED"];
    if (!mutableStatuses.includes(subscription.status)) {
      return NextResponse.json(
        {
          error: true,
          code: "SUBSCRIPTION_NOT_MUTABLE",
          message: `Cannot change plan on a subscription with status: ${subscription.status}`,
        },
        { status: 409 },
      );
    }

    const targetConfig = getPlanConfig(targetPlanId);
    const subscriptionId = subscription.razorpaySubscriptionId;

    // ── CASE 1: Downgrade to FREE — cancel at period end ────────────────────
    if (targetPlanId === "FREE") {
      if (subscription.cancelAtPeriodEnd) {
        return NextResponse.json({
          error: false,
          message: "Subscription is already scheduled for cancellation.",
          data: { planId: currentPlanId, changed: false },
        });
      }

      await razorpay.subscriptions.cancel(subscriptionId, true); // cancel_at_cycle_end = true

      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: {
          cancelAtPeriodEnd: true,
          scheduledPlanId: "FREE",
          scheduledChangeAt: subscription.currentPeriodEnd,
        },
      });

      logger.info("Subscription cancellation scheduled", {
        userId: authContext.appUserId,
        subscriptionId,
      });

      return NextResponse.json({
        error: false,
        data: {
          message: `Your subscription will cancel on ${subscription.currentPeriodEnd?.toLocaleDateString("en-IN") ?? "your next billing date"}. You keep ${currentPlanId} access until then.`,
          planId: currentPlanId,
          scheduledPlanId: "FREE",
          changed: true,
        },
      });
    }

    // ── CASE 2: Upgrade (STANDARD → PRO) — effective immediately ────────────
    if (isUpgrade(currentPlanId, targetPlanId)) {
      if (!targetConfig.razorpayPlanId) {
        return NextResponse.json(
          { error: true, message: "Target plan not configured in Razorpay." },
          { status: 500 },
        );
      }

      // If currently scheduled for cancellation, undo that first
      // Razorpay: update plan_id on a cancel-scheduled subscription reactivates it
      await (razorpay.subscriptions as Record<string, Function>).update(
        subscriptionId,
        {
          plan_id: targetConfig.razorpayPlanId,
          quantity: 1,
          remaining_count: 0,
          schedule_change_at: "now",
        },
      );

      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: {
          planId: targetPlanId, // Optimistic: grant new plan immediately
          razorpayPlanId: targetConfig.razorpayPlanId,
          cancelAtPeriodEnd: false, // Undo any pending cancellation
          scheduledPlanId: null,
          scheduledChangeAt: null,
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
          message: `You have been upgraded to ${targetConfig.displayName}. New features are active now.`,
          planId: targetPlanId,
          changed: true,
        },
      });
    }

    // ── CASE 3: Downgrade (PRO → STANDARD) — effective at cycle end ─────────
    if (isDowngrade(currentPlanId, targetPlanId)) {
      if (!targetConfig.razorpayPlanId) {
        return NextResponse.json(
          { error: true, message: "Target plan not configured in Razorpay." },
          { status: 500 },
        );
      }

      // If already scheduled for this downgrade, it's a no-op
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

      await (razorpay.subscriptions as Record<string, Function>).update(
        subscriptionId,
        {
          plan_id: targetConfig.razorpayPlanId,
          quantity: 1,
          remaining_count: 0,
          schedule_change_at: "cycle_end",
        },
      );

      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: {
          scheduledPlanId: targetPlanId,
          scheduledChangeAt: subscription.currentPeriodEnd,
          razorpayPlanId: targetConfig.razorpayPlanId,
          // planId stays as currentPlanId until webhook fires at cycle_end
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
          scheduledChangeAt:
            subscription.currentPeriodEnd?.toISOString() ?? null,
          changed: true,
          message: `Your plan will change to ${targetConfig.displayName} on ${subscription.currentPeriodEnd?.toLocaleDateString("en-IN") ?? "your next billing date"}. You keep ${currentPlanId} access until then.`,
        },
      });
    }

    return NextResponse.json(
      { error: true, message: "Unhandled plan change scenario." },
      { status: 400 },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Plan change failed", { error });
    return NextResponse.json(
      { error: true, message: "Plan change failed. Please try again." },
      { status: 500 },
    );
  }
}
