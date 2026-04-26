import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import logger from "@/lib/logger";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";

// Razorpay subscription.status → our SubscriptionStatus
const RAZORPAY_TO_STATUS: Record<string, SubscriptionStatus> = {
  created: "CREATED",
  authenticated: "AUTHENTICATED",
  active: "ACTIVE",
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
    entity: string;
    event: string;
    payload: Record<string, { entity: Record<string, unknown> }>;
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Razorpay does not provide a unique event ID in the body.
  // Use SHA-256 of the raw body as an idempotency key.
  const { createHash } = await import("crypto");
  const eventId = createHash("sha256").update(body).digest("hex").slice(0, 40);

  const existing = await prisma.razorpayWebhookEvent.findUnique({
    where: { id: eventId },
    select: { processedAt: true },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.razorpayWebhookEvent.upsert({
    where: { id: eventId },
    create: { id: eventId, type: event.event, rawPayload: JSON.parse(body) },
    update: {},
  });

  try {
    const eventType = event.event;
    logger.info("Received Razorpay webhook", { eventType, eventId });
    if (
      eventType === "subscription.activated" ||
      eventType === "subscription.completed" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.cancelled"
    ) {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;
      const razorpayPlanId = sub.plan_id as string | undefined;
      const isCancelled = eventType === "subscription.cancelled";

      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "ACTIVE";
      const ourPlanId = isCancelled
        ? "FREE"
        : planFromRazorpayPlanId(razorpayPlanId);

      const currentStart = sub.current_start as number | undefined;
      const currentEnd = sub.current_end as number | undefined;

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: {
          planId: ourPlanId,
          status: ourStatus,
          razorpayPlanId: razorpayPlanId ?? undefined,
          cancelAtPeriodEnd: Boolean(
            sub.cancel_at_period_end ?? sub.cancel_at_cycle_end,
          ),
          cancelledAt: isCancelled ? new Date() : null,
          currentPeriodStart: currentStart
            ? new Date(currentStart * 1000)
            : undefined,
          currentPeriodEnd: currentEnd
            ? new Date(currentEnd * 1000)
            : undefined,
          billingAnchorDay: currentStart
            ? new Date(currentStart * 1000).getDate()
            : undefined,
          generationLimit:
            ourPlanId === "FREE"
              ? 10
              : ourPlanId === "STANDARD"
                ? 100
                : undefined, // example of plan-based limit

          // Clear scheduled change when it takes effect
          // This fires when the cycle_end scheduled change activates
          scheduledPlanId: null,
          scheduledChangeAt: null,
        },
      });

      logger.info(`Razorpay ${eventType} handled`, {
        razorpaySubscriptionId,
        ourPlanId,
        ourStatus,
      });
    }

    if (eventType === "subscription.pending") {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;
      const razorpayStatus = sub.status as string;

      const ourStatus = RAZORPAY_TO_STATUS[razorpayStatus] ?? "PENDING";

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
          chargeFailureReason: `Razorpay subscription is in pending state after ${ourStatus === "PENDING" ? "first" : "second"} failed charge attempt.`,
        },
      });
    }

    if (eventType === "subscription.halted") {
      const sub = event.payload.subscription?.entity;
      if (!sub) throw new Error(`Missing subscription entity in ${eventType}`);

      const razorpaySubscriptionId = sub.id as string;

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
    }

    if (eventType === "subscription.charged") {
      // Successful renewal — update period dates and store last payment ID
      const sub = event.payload.subscription?.entity;
      const payment = event.payload.payment?.entity;
      if (!sub)
        throw new Error("Missing subscription entity in subscription.charged");

      const razorpaySubscriptionId = sub.id as string;
      const currentStart = sub.current_start as number | undefined;
      const currentEnd = sub.current_end as number | undefined;

      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId },
        data: {
          status: "ACTIVE",
          razorpayPaymentId: (payment?.id as string) ?? undefined,
          currentPeriodStart: currentStart
            ? new Date(currentStart * 1000)
            : undefined,
          currentPeriodEnd: currentEnd
            ? new Date(currentEnd * 1000)
            : undefined,
          chargeSuccessAt: currentStart
            ? new Date(currentStart * 1000)
            : undefined,
          chargeSuccesses: {
            increment: 1,
          },
        },
      });

      logger.info("Subscription charged successfully", {
        razorpaySubscriptionId,
      });
    }

    // if (eventType === "subscription.cancelled") {
    //   // Log org suspension for observability — members lose PRO access automatically
    //   // on their next request because effectivePlanId is computed from owner's subscription
    //   const affectedOrg = await prisma.organisation.findUnique({
    //     where: { ownerId: affectedUser?.id ?? "" },
    //     select: {
    //       id: true,
    //       name: true,
    //       _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    //     },
    //   });
    //   if (affectedOrg) {
    //     logger.info(
    //       "Org PRO access suspended due to subscription cancellation",
    //       {
    //         orgId: affectedOrg.id,
    //         affectedSeatCount: affectedOrg._count.memberships,
    //       },
    //     );
    //   }
    // }

    if (eventType === "payment.failed") {
      const payment = event.payload.payment?.entity;
      logger.warn("Payment failed", {
        paymentId: payment?.id,
        subscriptionId: payment?.subscription_id,
        errorCode: payment?.error_code,
        errorDesc: payment?.error_description,
      });
      // Razorpay will retry and eventually emit subscription.halted if retries are exhausted
      await prisma.subscription.updateMany({
        where: { razorpaySubscriptionId: payment?.subscription_id as string },
        data: {
          status: "PENDING",
          chargeFailures: {
            increment: 1,
          },
          chargeFailureReason: payment?.error_description as string,
        }, // no immediate status change — wait for Razorpay's retry mechanism
      });
    }

    await prisma.razorpayWebhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Razorpay webhook processing error", { eventId, error });
    await prisma.razorpayWebhookEvent.update({
      where: { id: eventId },
      data: { errorAt: new Date(), errorMsg: String(error) },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
