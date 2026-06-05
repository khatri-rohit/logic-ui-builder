/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import logger from "@/lib/logger";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();

// Razorpay subscription.status → our SubscriptionStatus
const RAZORPAY_TO_STATUS: Record<string, SubscriptionStatus> = {
  created: "CREATED",
  authenticated: "AUTHENTICATED",
  active: "ACTIVE",
  trialing: "ACTIVE",
  pending: "PENDING",
  halted: "HALTED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  expired: "EXPIRED",
  paused: "PAUSED",
};

// Razorpay plan_id → our PlanId
function planFromRazorpayPlanId(
  razorpayPlanId: string | undefined,
): "FREE" | "STANDARD" | "PRO" {
  if (!razorpayPlanId) return "FREE";
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_STANDARD) return "STANDARD";
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return "PRO";
  return "FREE";
}

function isDeadStatus(status: string): boolean {
  return ["CANCELLED", "COMPLETED", "EXPIRED", "HALTED"].includes(status);
}

async function invalidateSubscriptionCache(userId: string): Promise<void> {
  await redis.del(`auth:subscription:${userId}`).catch(() => {});
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  if (!secret) {
    logger.error("RAZORPAY_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  if (!verifyWebhookSignature(body, signature, secret)) {
    logger.warn("Razorpay webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    id: string;
    entity: string;
    event: string;
    payload: Record<string, { entity: Record<string, unknown> }>;
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Use Razorpay's native event ID for idempotency when available.
  // Test/simulated webhooks may not include an event id.
  const eventId = event.id;

  if (eventId) {
    const existing = await prisma.razorpayWebhookEvent.findUnique({
      where: { id: eventId },
      select: { processedAt: true },
    });
    if (existing?.processedAt) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await prisma.razorpayWebhookEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, type: event.event, rawPayload: event as any },
      update: {},
    });
  }

  try {
    const eventType = event.event;
    logger.info("Received Razorpay webhook", { eventType, eventId });

    // ── subscription.activated | updated | cancelled ──────────────────────
    if (
      eventType === "subscription.activated" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.cancelled" ||
      eventType === "subscription.canceled"
    ) {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;
      const razorpayPlanId = sub.plan_id as string | undefined;
      const isCancelled =
        eventType === "subscription.cancelled" ||
        eventType === "subscription.canceled";

      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "ACTIVE";

      // Fetch current DB state to compute conditional updates
      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: {
          userId: true,
          razorpayPlanId: true,
          scheduledPlanId: true,
          cancelAtPeriodEnd: true,
        },
      });

      const currentStart = sub.current_start as number | undefined;
      const currentEnd = sub.current_end as number | undefined;

      // Determine if a scheduled change actually took effect
      const planChanged =
        Boolean(dbSub?.razorpayPlanId) &&
        dbSub!.razorpayPlanId !== razorpayPlanId;
      const shouldClearScheduled =
        Boolean(dbSub?.scheduledPlanId) &&
        (planChanged || isCancelled || eventType === "subscription.activated");

      // For cancelled subs, keep access until currentPeriodEnd (grace period).
      // cancelAtPeriodEnd is a Stripe concept; Razorpay has no equivalent field.
      const isGracePeriodCancelled =
        isCancelled && currentEnd && Date.now() < currentEnd * 1000;

      const updateData: Record<string, unknown> = {
        status: ourStatus,
        razorpayPlanId: razorpayPlanId ?? undefined,
        // On activation/upgrade update planId to match the paid plan.
        // On cancellation keep the old planId so grace-period limits work.
        planId: isCancelled
          ? undefined
          : planFromRazorpayPlanId(razorpayPlanId),
        cancelAtPeriodEnd: isGracePeriodCancelled,
        currentPeriodStart: currentStart
          ? new Date(currentStart * 1000)
          : undefined,
        currentPeriodEnd: currentEnd ? new Date(currentEnd * 1000) : undefined,
        billingAnchorDay: currentStart
          ? new Date(currentStart * 1000).getDate()
          : undefined,
        generationLimit:
          planFromRazorpayPlanId(razorpayPlanId) === "FREE"
            ? 10
            : planFromRazorpayPlanId(razorpayPlanId) === "STANDARD"
              ? 100
              : undefined,
      };

      if (shouldClearScheduled) {
        updateData.scheduledPlanId = null;
        updateData.scheduledChangeAt = null;
      }

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: updateData as any,
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }

      logger.info(`Razorpay ${eventType} handled`, {
        razorpaySubscriptionId,
        ourStatus,
        planChanged,
        clearedScheduled: shouldClearScheduled,
      });
    }

    // ── subscription.completed | expired ────────────────────────────────────
    if (
      eventType === "subscription.completed" ||
      eventType === "subscription.expired"
    ) {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;
      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "ACTIVE";

      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: { userId: true },
      });

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: {
          status: ourStatus,
          planId: "FREE",
          cancelAtPeriodEnd: false,
          scheduledPlanId: null,
          scheduledChangeAt: null,
        },
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }

      logger.info(`Razorpay ${eventType} handled — access restricted`, {
        razorpaySubscriptionId,
        ourStatus,
      });
    }

    // ── subscription.pending ────────────────────────────────────────────────
    if (eventType === "subscription.pending") {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;

      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "PENDING";

      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: { userId: true },
      });

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: {
          status: ourStatus,
          chargeRetries: {
            increment: 1,
          },
          chargeFailures: {
            increment: 1,
          },
          chargeFailureAt: new Date(),
          chargeFailureReason: `Razorpay subscription is in pending state after failed charge attempt.`,
        },
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }
    }

    // ── subscription.halted ─────────────────────────────────────────────────
    if (eventType === "subscription.halted") {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;

      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: { userId: true },
      });

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: {
          status: "HALTED",
          chargeHaltCount: {
            increment: 1,
          },
          chargeFailureReason:
            "Razorpay subscription halted after multiple failed charge attempts.",
          chargeFailureAt: new Date(),
        },
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }
    }

    // ── subscription.charged ────────────────────────────────────────────────
    if (eventType === "subscription.charged") {
      // Successful renewal — update period dates and store last payment ID
      const sub = event.payload.subscription?.entity;
      const payment = event.payload.payment?.entity;
      if (!sub)
        throw new Error("Missing subscription entity in subscription.charged");

      const razorpaySubscriptionId = sub.id as string;
      const currentStart = sub.current_start as number | undefined;
      const currentEnd = sub.current_end as number | undefined;

      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: { userId: true, status: true },
      });

      const isDead = isDeadStatus(dbSub?.status ?? "");

      const updateData: Record<string, unknown> = {
        razorpayPaymentId: (payment?.id as string) ?? undefined,
        currentPeriodStart: currentStart
          ? new Date(currentStart * 1000)
          : undefined,
        currentPeriodEnd: currentEnd ? new Date(currentEnd * 1000) : undefined,
        chargeFailures: 0,
        chargeRetries: 0,
        chargeFailureReason: null,
      };

      if (!isDead) {
        updateData.status = "ACTIVE";
        const rzpPlanId = sub.plan_id as string | undefined;
        updateData.planId = planFromRazorpayPlanId(rzpPlanId);
        updateData.cancelAtPeriodEnd = false;
      }

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: updateData as any,
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }

      logger.info("Subscription charged", {
        razorpaySubscriptionId,
        reactivated: !isDead,
        previousStatus: dbSub?.status,
      });
    }

    // ── subscription.resumed | paused ───────────────────────────────────────
    if (
      eventType === "subscription.resumed" ||
      eventType === "subscription.paused"
    ) {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;
      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "ACTIVE";
      const rzpPlanId = sub.plan_id as string | undefined;

      const dbSub = await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId },
        select: { userId: true },
      });

      const updateData: Record<string, unknown> = { status: ourStatus };
      if (eventType === "subscription.resumed") {
        updateData.planId = planFromRazorpayPlanId(rzpPlanId);
      }

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: updateData,
      });

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }

      logger.info(`Razorpay ${eventType} handled`, {
        razorpaySubscriptionId,
        ourStatus,
      });
    }

    if (eventType === "payment.failed") {
      const payment = event.payload.payment?.entity;
      logger.warn("Payment failed", {
        paymentId: payment?.id,
        subscriptionId: payment?.subscription_id,
        errorCode: payment?.error_code,
        errorDesc: payment?.error_description,
      });

      const razorpaySubscriptionId = payment?.subscription_id as string;
      const dbSub = razorpaySubscriptionId
        ? await prisma.subscription.findUnique({
            where: { razorpaySubscriptionId },
            select: { userId: true },
          })
        : null;

      // Razorpay will retry and eventually emit subscription.halted if retries are exhausted
      if (razorpaySubscriptionId) {
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: {
            status: "PENDING",
            chargeFailures: {
              increment: 1,
            },
            chargeFailureReason: payment?.error_description as string,
          },
        });
      }

      if (dbSub?.userId) {
        await invalidateSubscriptionCache(dbSub.userId);
      }
    }

    if (eventId) {
      await prisma.razorpayWebhookEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Razorpay webhook processing error", { eventId, error });
    if (eventId) {
      await prisma.razorpayWebhookEvent.update({
        where: { id: eventId },
        data: { errorAt: new Date(), errorMsg: String(error) },
      });
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
