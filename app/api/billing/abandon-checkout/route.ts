import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.abandon_checkout",
    });

    const body = (await req.json()) as { subscriptionId?: string };
    const subscriptionId = body.subscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: true, message: "Missing subscription ID." },
        { status: 400 },
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        id: true,
        status: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: true, message: "No subscription found." },
        { status: 404 },
      );
    }

    if (subscription.status !== "CREATED" && subscription.status !== "PENDING") {
      return NextResponse.json({
        error: false,
        message: "Subscription is not in a pending state.",
        data: { changed: false },
      });
    }

    await prisma.subscription.update({
      where: { userId: authContext.appUserId },
      data: {
        status: "ACTIVE",
        razorpaySubscriptionId: null,
        razorpayPlanId: null,
        scheduledPlanId: null,
        scheduledChangeAt: null,
      },
    });

    try {
      await redis.del(`checkout:lock:${authContext.appUserId}`);
    } catch {
      // ignore redis errors
    }

    return NextResponse.json({
      error: false,
      message: "Checkout abandoned successfully.",
      data: { changed: true },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("Error abandoning checkout: ", { error });
    return NextResponse.json(
      { error: true, message: "Failed to abandon checkout." },
      { status: 500 },
    );
  }
}
