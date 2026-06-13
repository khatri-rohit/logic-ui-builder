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
  const clampedDay = (year: number, monthIdx: number) => {
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    return Math.min(anchor, lastDay);
  };
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonthStart = new Date(y, m, clampedDay(y, m));
  const nextMonthStart = new Date(y, m + 1, clampedDay(y, m + 1));
  const prevMonthStart = new Date(y, m - 1, clampedDay(y, m - 1));
  const periodStart = thisMonthStart <= now ? thisMonthStart : prevMonthStart;
  const periodEnd = thisMonthStart <= now ? nextMonthStart : thisMonthStart;
  return { periodStart, periodEnd };
}

export async function getOrCreateUsagePeriod(
  userId: string,
  effectivePlanId: "FREE" | "STANDARD" | "PRO",
): Promise<UsageContext | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      billingAnchorDay: true,
      generationLimit: true,
      projectLimit: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) {
    return null;
  }

  const now = new Date();
  const razorpayPeriodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  // Stale-date guard: if Razorpay currentPeriodEnd is in the past, webhooks
  // failed to update it. Treat as missing so usage rolls over via anchor-day
  // math instead of getting stuck in an expired period forever.
  const razorpayDatesValid =
    subscription.currentPeriodStart &&
    razorpayPeriodEnd &&
    razorpayPeriodEnd > now;

  // effectivePlanId is the caller's computed plan from auth context
  // (handles personal plan, org PRO inheritance, grace period, FREE fallback)
  const planId = effectivePlanId as PlanId;

  const planConfig = getPlanConfig(planId);
  const effectiveGenerationLimit = getEffectiveGenerationLimit(
    planId,
    subscription.generationLimit,
  );
  const effectiveProjectLimit = getEffectiveProjectLimit(
    planId,
    subscription.projectLimit,
  );

  let periodBounds: { periodStart: Date; periodEnd: Date };
  if (razorpayDatesValid) {
    periodBounds = {
      periodStart: subscription.currentPeriodStart!,
      periodEnd: subscription.currentPeriodEnd!,
    };
  } else {
    periodBounds = getPeriodBounds(subscription.billingAnchorDay);
  }

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

/**
 * Atomically reserve one generation slot.
 * Returns true if the slot was reserved, false if the quota is exhausted.
 * Uses a CHECK-AND-INCREMENT in a single SQL statement to eliminate TOCTOU.
 */
export async function reserveGenerationSlot(
  usagePeriodId: string,
  generationLimit: number,
): Promise<boolean> {
  if (generationLimit === -1) {
    // Unlimited plan — increment unconditionally
    await prisma.$executeRaw`
      UPDATE "UsagePeriod"
      SET "generationsUsed" = "generationsUsed" + 1, "updatedAt" = NOW()
      WHERE "id" = ${usagePeriodId}
    `;
    return true;
  }

  const result = await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "generationsUsed" = "generationsUsed" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
      AND "generationsUsed" < ${generationLimit}
  `;
  // $executeRaw returns the number of affected rows
  return (result as number) === 1;
}

export async function reserveProjectSlot(
  usagePeriodId: string,
  projectLimit: number,
): Promise<boolean> {
  if (projectLimit === -1) {
    await prisma.$executeRaw`
      UPDATE "UsagePeriod"
      SET "projectsCreated" = "projectsCreated" + 1, "updatedAt" = NOW()
      WHERE "id" = ${usagePeriodId}
    `;
    return true;
  }

  const result = await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "projectsCreated" = "projectsCreated" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
      AND "projectsCreated" < ${projectLimit}
  `;

  return (result as number) === 1;
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

export async function releaseGenerationSlot(
  usagePeriodId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "generationsUsed" = GREATEST("generationsUsed" - 1, 0), "updatedAt" = NOW()
    WHERE "id" = ${usagePeriodId}
  `;
}

export async function releaseFrameRegenUsage(
  usagePeriodId: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UsagePeriod"
    SET "framesRegenUsed" = GREATEST("framesRegenUsed" - 1, 0), "updatedAt" = NOW()
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
