export type PlanId = "FREE" | "STANDARD" | "PRO";

export interface PlanConfig {
  id: PlanId;
  displayName: string;
  monthlyGenerationLimit: number; // -1 = unlimited
  projectLimit: number; // -1 = unlimited
  frameRegenerationEnabled: boolean;
  allowedModels: readonly string[];
  organizationEnabled: boolean;
  rolloverGenerations: number; // max rollover from previous period
  // Razorpay plan IDs — set from env at runtime
  razorpayPlanId: string | null;
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    displayName: "Free",
    monthlyGenerationLimit: 10,
    projectLimit: 3,
    frameRegenerationEnabled: false,
    allowedModels: ["gemma4:31b"],
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
    allowedModels: [
      "gemma4:31b",
      "gpt-oss:120b",
      "deepseek-v3.1:671b",
      "qwen3.5",
    ],
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
    allowedModels: [
      "gemma4:31b",
      "gpt-oss:120b",
      "deepseek-v3.1:671b",
      "qwen3.5",
      "deepseek-v3.2:cloud",
    ],
    organizationEnabled: true,
    rolloverGenerations: 50,
    razorpayPlanId: process.env.RAZORPAY_PLAN_PRO ?? null,
  },
};

export function getPlanConfig(planId: PlanId | string): PlanConfig {
  return PLAN_CONFIGS[planId as PlanId] ?? PLAN_CONFIGS.FREE;
}

export function isModelAllowed(
  planId: PlanId | string,
  model: string,
): boolean {
  return (getPlanConfig(planId).allowedModels as string[]).includes(model);
}

export function getEffectiveGenerationLimit(
  planId: PlanId | string,
  overrideLimit: number | null | undefined,
): number {
  if (typeof overrideLimit === "number" && overrideLimit > 0)
    return overrideLimit;
  return getPlanConfig(planId).monthlyGenerationLimit;
}

export function getEffectiveProjectLimit(
  planId: PlanId | string,
  overrideLimit: number | null | undefined,
): number {
  if (typeof overrideLimit === "number" && overrideLimit > 0)
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
