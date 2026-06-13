import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import { isRazorpayError } from "@/lib/razorpay-types";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getPlanConfig } from "@/lib/plans";
import logger from "@/lib/logger";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const CHECKOUT_LOCK_TTL = 120; // seconds

const bodySchema = z.object({ planId: z.enum(["STANDARD", "PRO"]) });

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.checkout.initiated",
    });

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: true, message: "Invalid plan" },
        { status: 400 },
      );
    }

    const planConfig = getPlanConfig(body.data.planId);
    if (!planConfig.razorpayPlanId) {
      return NextResponse.json(
        { error: true, message: "Razorpay plan not configured for this tier." },
        { status: 500 },
      );
    }

    // Atomically acquire lock to prevent duplicate checkout attempts
    const lockKey = `checkout:lock:${authContext.appUserId}`;
    const lockAcquired = await redis.set(lockKey, body.data.planId, {
      nx: true,
      ex: CHECKOUT_LOCK_TTL,
    });
    if (!lockAcquired) {
      return NextResponse.json(
        {
          error: true,
          code: "CHECKOUT_IN_PROGRESS",
          message: "A checkout is already in progress. Please complete or cancel it first.",
        },
        { status: 429 },
      );
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        razorpayCustomerId: true,
        razorpaySubscriptionId: true,
        status: true,
      },
    });

    // Prevent overwriting an active subscription with a new checkout
    if (
      existingSubscription?.razorpaySubscriptionId &&
      ["ACTIVE", "AUTHENTICATED", "TRIALING"].includes(
        existingSubscription.status,
      )
    ) {
      return NextResponse.json(
        {
          error: true,
          code: "ACTIVE_SUBSCRIPTION_EXISTS",
          message:
            "You already have an active subscription. Use the plan change flow instead.",
        },
        { status: 409 },
      );
    }

    let customerId = existingSubscription?.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        email: authContext.email,
        name: authContext.name || authContext.email.split("@")[0],
        fail_existing: 0, // return existing customer if email matches
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: { razorpayCustomerId: customerId },
      });
    }

    // Create Razorpay subscription
    // Note: customer_id is supported by the API but missing from SDK types
    const razorpaySub = await razorpay.subscriptions.create({
      plan_id: planConfig.razorpayPlanId,
      customer_id: customerId,
      quantity: 1,
      total_count: 999,
      addons: [],
      notify_info: {
        notify_phone: "",
        notify_email: authContext.email,
      },
    } as unknown as Parameters<typeof razorpay.subscriptions.create>[0]);

    logger.info("Razorpay subscription created", { razorpaySub });

    // Store the pending subscription ID — will be activated via webhook.
    // Wipe all stale lifecycle fields from any prior subscription history.
    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        razorpaySubscriptionId: razorpaySub.id,
        razorpayPlanId: planConfig.razorpayPlanId,
        status: "CREATED",
        planId: "FREE", // stays FREE until webhook confirms ACTIVE
        scheduledPlanId: null,
        scheduledChangeAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        currentPeriodStart: null,
        billingAnchorDay: null,
        chargeFailures: 0,
        chargeRetries: 0,
        chargeHaltCount: 0,
        chargeFailureReason: null,
        chargeFailureAt: null,
      },
    });

    // short_url is Razorpay's hosted checkout link
    return NextResponse.json({
      error: false,
      data: {
        subscriptionId: razorpaySub.id,
        shortUrl: null,
        // Also return key_id for client-side Razorpay.js modal
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Error creating subscription: ", { error });
    if (isRazorpayError(error)) {
      return NextResponse.json(
        {
          error: true,
          message: error.error.description ?? "Failed to create subscription.",
        },
        { status: Number(error.statusCode) ?? 500 },
      );
    }
    return NextResponse.json(
      {
        error: true,
        message: (error instanceof Error ? error.message : undefined) ?? "Failed to create subscription.",
      },
      { status: 500 },
    );
  }
}
