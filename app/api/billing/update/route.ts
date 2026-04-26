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
      eventType: "billing.update.initiated",
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

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        planId: true,
        status: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
      },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return NextResponse.json(
        {
          error: true,
          message: "No active Razorpay subscription found for this account.",
        },
        { status: 404 },
      );
    }

    if (subscription.planId === body.data.planId) {
      return NextResponse.json(
        {
          error: false,
          message: "Subscription is already on the requested plan.",
          data: {
            planId: subscription.planId,
            status: subscription.status,
            shortUrl: null,
          },
        },
        { status: 200 },
      );
    }

    try {
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        customer_notify: 1,
        plan_id: planConfig.razorpayPlanId,
      });

      await prisma.subscription.update({
        where: { userId: authContext.appUserId },
        data: {
          planId: body.data.planId,
          razorpayPlanId: planConfig.razorpayPlanId,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });
    } catch (error) {
      logger.error("Error updating Razorpay subscription: ", { error });
      return NextResponse.json(
        {
          error: true,
          message: "Failed to update subscription.",
          details: error,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      error: false,
      message: "Subscription update initiated.",
      data: {
        planId: body.data.planId,
        status: subscription.status,
        shortUrl: null,
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }

    logger.error("Error updating subscription: ", { error });
    return NextResponse.json(
      {
        error: true,
        message: "Failed to update subscription.",
        details: error,
      },
      { status: 500 },
    );
  }
}
