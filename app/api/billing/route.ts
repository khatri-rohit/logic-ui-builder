import { requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.subscription.fetched",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Unauthorized. Authentication is required to access this endpoint.",
        },
        { status: 401 },
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: authContext.appUserId },
      select: {
        planId: true,
        status: true,
        cancelAtPeriodEnd: true,
      },
    });

    // This endpoint is not meant to be called directly. It serves as a redirect target after successful payment.
    // The actual subscription creation and payment processing happens in the POST /api/billing/checkout endpoint.
    return NextResponse.json(
      {
        error: false,
        message: "Subscription details retrieved successfully.",
        data: {
          planId: subscription?.planId || null,
          status: subscription?.status || null,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("GET /api/billing failed", { error });
    return NextResponse.json(
      {
        error: true,
        message: "An unexpected error occurred.",
      },
      { status: 500 },
    );
  }
}
