import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getPlanConfig } from "@/lib/plans";
import logger from "@/lib/logger";

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

    // Get or create Razorpay customer
    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: { razorpayCustomerId: true },
    });

    let customerId = subscription?.razorpayCustomerId;
    if (!customerId) {
      const customer = await razorpay.customers.create({
        email: authContext.email,
        name: authContext.email.split("@")[0],
        fail_existing: 0, // return existing customer if email matches
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: { razorpayCustomerId: customerId },
      });
    }

    // Create Razorpay subscription
    // total_count: 0 means perpetual (renews until cancelled)
    const razorpaySub = await razorpay.subscriptions.create({
      plan_id: planConfig.razorpayPlanId,
      // customer_notify: 1, // Razorpay will send email to customer
      quantity: 1,
      total_count: 120,
      addons: [],
      notify_info: {
        notify_phone: "",
        notify_email: authContext.email,
      },
      // ADD THESE TWO LINES:
      // callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success`,
      // callback_method: "get",
    });
    logger.info("Razorpay subscription created", { razorpaySub });
    // Store the pending subscription ID — will be activated via webhook
    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        razorpaySubscriptionId: razorpaySub.id,
        razorpayPlanId: planConfig.razorpayPlanId,
        status: "CREATED",
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
    return NextResponse.json(
      { error: true, message: "Failed to create subscription." },
      { status: 500 },
    );
  }
}
