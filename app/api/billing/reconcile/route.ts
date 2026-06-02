import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { razorpay } from "@/lib/razorpay";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();

const RAZORPAY_TO_STATUS: Record<string, string> = {
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

async function invalidateSubscriptionCache(userId: string): Promise<void> {
  await redis.del(`auth:subscription:${userId}`).catch(() => {});
  await redis.del(`auth:context:${userId}`).catch(() => {});
}

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  try {
    const now = new Date();

    const subsToCheck = await prisma.subscription.findMany({
      where: {
        OR: [
          {
            status: { in: ["ACTIVE", "AUTHENTICATED", "PENDING", "CREATED"] },
            razorpaySubscriptionId: { not: null },
          },
          {
            status: "CANCELLED",
            razorpaySubscriptionId: { not: null },
            currentPeriodEnd: { gt: now },
          },
        ],
      },
      select: {
        userId: true,
        status: true,
        planId: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
        currentPeriodEnd: true,
      },
    });

    let synced = 0;
    let mismatches = 0;

    for (const dbSub of subsToCheck) {
      if (!dbSub.razorpaySubscriptionId) continue;

      try {
        const rzpSub = (await razorpay.subscriptions.fetch(
          dbSub.razorpaySubscriptionId,
        )) as {
          status: string;
          plan_id?: string;
          current_start?: number;
          current_end?: number;
        };

        const rzpStatus = RAZORPAY_TO_STATUS[rzpSub.status] ?? rzpSub.status;
        const needsUpdate: Record<string, unknown> = {};

        if (dbSub.status !== rzpStatus) {
          needsUpdate.status = rzpStatus;
          mismatches++;
        }

        if (rzpSub.plan_id && dbSub.razorpayPlanId !== rzpSub.plan_id) {
          needsUpdate.razorpayPlanId = rzpSub.plan_id;
          mismatches++;
        }

        // Grace period expiry: if cancelled and past currentPeriodEnd, downgrade to FREE
        const graceExpired =
          rzpStatus === "CANCELLED" &&
          dbSub.currentPeriodEnd &&
          now >= new Date(dbSub.currentPeriodEnd);

        if (graceExpired) {
          needsUpdate.planId = "FREE";
          needsUpdate.razorpaySubscriptionId = null;
          needsUpdate.razorpayPlanId = null;
          needsUpdate.cancelledAt = null;
          needsUpdate.scheduledPlanId = null;
          needsUpdate.scheduledChangeAt = null;
          mismatches++;
        }

        if (Object.keys(needsUpdate).length > 0) {
          await prisma.subscription.update({
            where: { userId: dbSub.userId },
            data: needsUpdate,
          });
          await invalidateSubscriptionCache(dbSub.userId);
          synced++;

          logger.info("Reconciliation synced subscription", {
            userId: dbSub.userId,
            razorpaySubscriptionId: dbSub.razorpaySubscriptionId,
            updates: Object.keys(needsUpdate),
          });
        }
      } catch (fetchError) {
        logger.warn("Reconciliation fetch failed", {
          userId: dbSub.userId,
          razorpaySubscriptionId: dbSub.razorpaySubscriptionId,
          error: String(fetchError),
        });
      }

      // Rate-limit: pause 200ms between requests to avoid Razorpay limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("Reconciliation completed", {
      checked: subsToCheck.length,
      synced,
      mismatches,
    });

    return NextResponse.json({
      ok: true,
      checked: subsToCheck.length,
      synced,
      mismatches,
    });
  } catch (error) {
    logger.error("Reconciliation job failed", { error });
    return NextResponse.json(
      { error: "Reconciliation failed" },
      { status: 500 },
    );
  }
});
