import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaymentSignature } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";

const bodySchema = z.object({
  razorpaySubscriptionId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.payment.verified",
    });

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: true, message: "Invalid payload" },
        { status: 400 },
      );
    }

    const isValid = verifyPaymentSignature(body.data);
    if (!isValid) {
      return NextResponse.json(
        {
          error: true,
          code: "INVALID_SIGNATURE",
          message: "Payment signature verification failed.",
        },
        { status: 400 },
      );
    }

    // Signature is valid — the webhook will handle the full status update.
    // Here we just confirm the subscription ID belongs to this user.
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: authContext.appUserId,
        razorpaySubscriptionId: body.data.razorpaySubscriptionId,
      },
      select: { id: true, planId: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: true, message: "Subscription not found for this user." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      error: false,
      message: "Payment verified. Your plan will activate shortly.",
      data: { planId: subscription.planId },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: true, message: "Verification failed." },
      { status: 500 },
    );
  }
}
