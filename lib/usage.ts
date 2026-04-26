import prisma from "@/lib/prisma";
import {
  getPlanConfig,
  getEffectiveGenerationLimit,
  getEffectiveProjectLimit,
  PlanId,
} from "@/lib/plans";

export interface UsageContext {
  userId: string;
  planId: PlanId;
  generationLimit: number; // effective (plan default or admin override)
  projectLimit: number;
  generationsUsed: number;
  generationsRemaining: number; // -1 = unlimited
  projectsCreated: number;
  projectsRemaining: number; // -1 = unlimited
  frameRegenerationEnabled: boolean;
  periodStart: Date;
  periodEnd: Date;
  usagePeriodId: string;
}

function getPeriodBounds(billingAnchorDay: number | null): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  const anchor = billingAnchorDay ?? 1;
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), anchor);
  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    anchor,
  );
  const prevMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    anchor,
  );

  const periodStart = thisMonthStart <= now ? thisMonthStart : prevMonthStart;
  const periodEnd = thisMonthStart <= now ? nextMonthStart : thisMonthStart;
  return { periodStart, periodEnd };
}

export async function getOrCreateUsagePeriod(
  userId: string,
  effectivePlanOverride?: "FREE" | "STANDARD" | "PRO",
): Promise<UsageContext | null> {
  let subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      planId: true,
      status: true,
      billingAnchorDay: true,
      generationLimit: true,
      projectLimit: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) {
    // Safety net — auto-provision FREE subscription
    const created = await prisma.subscription.upsert({
      where: { userId },
      create: { userId, planId: "FREE", status: "ACTIVE" },
      update: {},
      select: {
        id: true,
        planId: true,
        status: true,
        billingAnchorDay: true,
        generationLimit: true,
        projectLimit: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });
    subscription = created;
  }

  // const planId = subscription.planId as PlanId;
  // Use override when provided (member inheriting org PRO)
  const planId = (effectivePlanOverride ?? subscription.planId) as PlanId;

  const planConfig = getPlanConfig(planId);
  const effectiveGenerationLimit = getEffectiveGenerationLimit(
    planId,
    subscription.generationLimit,
  );
  const effectiveProjectLimit = getEffectiveProjectLimit(
    planId,
    subscription.projectLimit,
  );

  // Use Razorpay period dates when available; fall back to calendar calculation
  const periodBounds =
    subscription.currentPeriodStart && subscription.currentPeriodEnd
      ? {
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        }
      : getPeriodBounds(subscription.billingAnchorDay);

  // Upsert is safe for concurrent requests — @@unique constraint prevents duplicates
  const usagePeriod = await prisma.usagePeriod.upsert({
    where: {
      subscriptionId_periodStart: {
        subscriptionId: subscription.id,
        periodStart: periodBounds.periodStart,
      },
    },
    create: {
      subscriptionId: subscription.id,
      userId,
      periodStart: periodBounds.periodStart,
      periodEnd: periodBounds.periodEnd,
      generationsUsed: 0,
      framesRegenUsed: 0,
      projectsCreated: 0,
    },
    update: {},
    select: { id: true, generationsUsed: true, projectsCreated: true },
  });

  const generationsRemaining =
    effectiveGenerationLimit === -1
      ? -1
      : Math.max(0, effectiveGenerationLimit - usagePeriod.generationsUsed);

  const projectsRemaining =
    effectiveProjectLimit === -1
      ? -1
      : Math.max(0, effectiveProjectLimit - usagePeriod.projectsCreated);

  return {
    userId,
    planId,
    generationLimit: effectiveGenerationLimit,
    projectLimit: effectiveProjectLimit,
    generationsUsed: usagePeriod.generationsUsed,
    generationsRemaining,
    projectsCreated: usagePeriod.projectsCreated,
    projectsRemaining,
    frameRegenerationEnabled: planConfig.frameRegenerationEnabled,
    periodStart: periodBounds.periodStart,
    periodEnd: periodBounds.periodEnd,
    usagePeriodId: usagePeriod.id,
  };
}

/** Atomic increment — avoids race conditions on concurrent requests */
export async function incrementGenerationUsage(
  usagePeriodId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "generationsUsed" = "generationsUsed" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
  `;
}

export async function incrementFrameRegenUsage(
  usagePeriodId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "framesRegenUsed" = "framesRegenUsed" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
  `;
}

export async function incrementProjectUsage(
  usagePeriodId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "projectsCreated" = "projectsCreated" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
  `;
}
