import { NextResponse } from "next/server";
import { AppAuthContext } from "@/lib/get-auth";
import { getPlanConfig, isModelAllowed } from "@/lib/plans";
import { getOrCreateUsagePeriod, UsageContext } from "@/lib/usage";
// import {
//   createOrganisation,
//   hasAvailableSeat,
//   ORG_MAX_SEATS_PRO,
// } from "@/lib/org";
import prisma from "./prisma";

export type PlanGuardResult =
  | { allowed: true; usage: UsageContext }
  | { allowed: false; response: NextResponse };

function quotaExceededResponse(
  used: number,
  limit: number,
  planId: string,
): NextResponse {
  return NextResponse.json(
    {
      error: true,
      code: "QUOTA_EXCEEDED",
      message: `You have used ${used} of ${limit} generations on the ${planId} plan this month.`,
      data: {
        generationsUsed: used,
        generationLimit: limit,
        planId,
        upgradeUrl: "/billing/upgrade",
      },
    },
    { status: 402 },
  );
}

export async function guardGenerationRequest(
  authContext: AppAuthContext,
  requestedModel: string | undefined,
): Promise<PlanGuardResult> {
  const usage = await getOrCreateUsagePeriod(
    authContext.appUserId,
    authContext.effectivePlanId, // pass effective plan
  );
  if (!usage) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: true,
          code: "USAGE_UNAVAILABLE",
          message: "Could not load usage context.",
        },
        { status: 503 },
      ),
    };
  }

  if (usage.generationsRemaining === 0) {
    return {
      allowed: false,
      response: quotaExceededResponse(
        usage.generationsUsed,
        usage.generationLimit,
        authContext.planId,
      ),
    };
  }

  if (
    requestedModel &&
    !isModelAllowed(authContext.effectivePlanId, requestedModel)
  ) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: true,
          code: "MODEL_NOT_ALLOWED",
          message: `Model "${requestedModel}" is not available on the ${authContext.effectivePlanId} plan.`,
          data: {
            planId: authContext.effectivePlanId,
            allowedModels: getPlanConfig(authContext.effectivePlanId)
              .allowedModels,
            upgradeUrl: "/billing/upgrade",
          },
        },
        { status: 403 },
      ),
    };
  }

  return { allowed: true, usage };
}

export async function guardProjectCreation(
  authContext: AppAuthContext,
): Promise<PlanGuardResult> {
  const usage = await getOrCreateUsagePeriod(
    authContext.appUserId,
    authContext.effectivePlanId, // pass effective plan
  );
  if (!usage) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: true, code: "USAGE_UNAVAILABLE" },
        { status: 503 },
      ),
    };
  }

  if (usage.projectsRemaining === 0) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: true,
          code: "PROJECT_LIMIT_REACHED",
          message: `You have reached the ${usage.projectLimit}-project limit on the ${authContext.effectivePlanId} plan.`,
          data: {
            planId: authContext.effectivePlanId,
            projectsCreated: usage.projectsCreated,
            projectLimit: usage.projectLimit,
            upgradeUrl: "/billing/upgrade",
          },
        },
        { status: 402 },
      ),
    };
  }

  return { allowed: true, usage };
}

export async function guardFrameRegeneration(
  authContext: AppAuthContext,
): Promise<PlanGuardResult> {
  const usage = await getOrCreateUsagePeriod(
    authContext.appUserId,
    authContext.effectivePlanId, // pass effective plan
  );
  if (!usage) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: true, code: "USAGE_UNAVAILABLE" },
        { status: 503 },
      ),
    };
  }

  if (!usage.frameRegenerationEnabled) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: true,
          code: "FEATURE_NOT_ON_PLAN",
          message: "Frame regeneration is available on Standard and Pro plans.",
          data: {
            planId: authContext.effectivePlanId,
            upgradeUrl: "/billing/upgrade",
          },
        },
        { status: 402 },
      ),
    };
  }

  return { allowed: true, usage };
}

/**
 * Guard for POST /api/org — can this user create an organisation?
 * Requires PRO personal plan (not just effective plan).
 * An org member who inherits PRO cannot create a second org — only their own PRO subscription qualifies.
 */
// export async function guardOrgCreation(
//   authContext: AppAuthContext,
// ): Promise<PlanGuardResult> {
//   // Must have PERSONAL PRO, not just org-inherited PRO
//   if (authContext.planId !== "PRO") {
//     return {
//       allowed: false,
//       response: NextResponse.json(
//         {
//           error: true,
//           code: "PRO_REQUIRED",
//           message: "Creating an organisation requires a Pro subscription.",
//           data: { upgradeUrl: "/billing/upgrade" },
//         },
//         { status: 402 },
//       ),
//     };
//   }

//   // Cannot create a second org
//   const existing = await prisma.organisation.findUnique({
//     where: { ownerId: authContext.appUserId },
//     select: { id: true },
//   });

//   if (existing) {
//     return {
//       allowed: false,
//       response: NextResponse.json(
//         {
//           error: true,
//           code: "ORG_ALREADY_EXISTS",
//           message:
//             "You already own an organisation. A Pro account can own only one organisation.",
//         },
//         { status: 409 },
//       ),
//     };
//   }

//   // Fake UsageContext — org creation has no usage to return
//   return { allowed: true, usage: null as never };
// }

// /**
//  * Guard for POST /api/org/invite — can this user invite a new member?
//  * Checks both org ownership/admin role and available seat count.
//  */
// export async function guardOrgInvite(
//   authContext: AppAuthContext,
//   organisationId: string,
// ): Promise<PlanGuardResult> {
//   if (!authContext.isOrgOwner && authContext.orgRole !== "ADMIN") {
//     return {
//       allowed: false,
//       response: NextResponse.json(
//         {
//           error: true,
//           code: "FORBIDDEN",
//           message: "Only org owners and admins can invite members.",
//         },
//         { status: 403 },
//       ),
//     };
//   }

//   const org = await prisma.organisation.findUnique({
//     where: { id: organisationId },
//     select: { maxSeats: true },
//   });

//   if (!org) {
//     return {
//       allowed: false,
//       response: NextResponse.json(
//         {
//           error: true,
//           code: "ORG_NOT_FOUND",
//           message: "Organisation not found.",
//         },
//         { status: 404 },
//       ),
//     };
//   }

//   const seatAvailable = await hasAvailableSeat(organisationId, org.maxSeats);
//   if (!seatAvailable) {
//     return {
//       allowed: false,
//       response: NextResponse.json(
//         {
//           error: true,
//           code: "SEAT_LIMIT_REACHED",
//           message: `This organisation has reached its ${org.maxSeats}-seat limit.`,
//           data: { maxSeats: org.maxSeats, upgradeUrl: "/billing/upgrade" },
//         },
//         { status: 402 },
//       ),
//     };
//   }

//   return { allowed: true, usage: null as never };
// }
