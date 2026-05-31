export type PlanId = "FREE" | "STANDARD" | "PRO";

export interface PlanConfig {
  id: PlanId;
  displayName: string;
  monthlyGenerationLimit: number; // -1 = unlimited
  projectLimit: number; // -1 = unlimited
  frameRegenerationEnabled: boolean;
  organizationEnabled: boolean;
  rolloverGenerations: number; // max rollover from previous period
  razorpayPlanId: string | null;
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    displayName: "Free",
    monthlyGenerationLimit: 10,
    projectLimit: 3,
    frameRegenerationEnabled: false,
    organizationEnabled: false,
    rolloverGenerations: 0,
    razorpayPlanId: null,
  },
  STANDARD: {
    id: "STANDARD",
    displayName: "Standard",
    monthlyGenerationLimit: 100,
    projectLimit: -1,
    frameRegenerationEnabled: true,
    organizationEnabled: false,
    rolloverGenerations: 0,
    razorpayPlanId: process.env.RAZORPAY_PLAN_STANDARD ?? null,
  },
  PRO: {
    id: "PRO",
    displayName: "Pro",
    monthlyGenerationLimit: -1,
    projectLimit: -1,
    frameRegenerationEnabled: true,
    organizationEnabled: true,
    rolloverGenerations: 50,
    razorpayPlanId: process.env.RAZORPAY_PLAN_PRO ?? null,
  },
};

export function getPlanConfig(planId: PlanId | string): PlanConfig {
  const cfg = PLAN_CONFIGS[planId as PlanId];
  if (!cfg) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[plans] Unknown planId "${planId}", falling back to FREE`);
    }
    return PLAN_CONFIGS.FREE;
  }
  return cfg;
}

export function getEffectiveGenerationLimit(
  planId: PlanId | string,
  overrideLimit: number | null | undefined,
): number {
  if (
    typeof overrideLimit === "number" &&
    (overrideLimit > 0 || overrideLimit === -1)
  )
    return overrideLimit;
  return getPlanConfig(planId).monthlyGenerationLimit;
}

export function getEffectiveProjectLimit(
  planId: PlanId | string,
  overrideLimit: number | null | undefined,
): number {
  if (
    typeof overrideLimit === "number" &&
    (overrideLimit > 0 || overrideLimit === -1)
  )
    return overrideLimit;
  return getPlanConfig(planId).projectLimit;
}

export const ORG_MAX_SEATS_BY_PLAN: Record<PlanId, number> = {
  FREE: 0,
  STANDARD: 0,
  PRO: 5,
};

export function canCreateOrg(planId: PlanId | string): boolean {
  return planId === "PRO";
}

export function getMaxSeatsForPlan(planId: PlanId | string): number {
  return ORG_MAX_SEATS_BY_PLAN[planId as PlanId] ?? 0;
}
