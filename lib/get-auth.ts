import { auth, clerkClient as getClerkClient } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import type { OrgMemberRole } from "@/app/generated/prisma/client";

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";

const EMAIL_FALLBACK_DOMAIN = "clerk.local";
const redis = Redis.fromEnv();

const CLERK_USER_TTL = 60; // seconds
const SUBSCRIPTION_TTL = 60;
const AUTH_CONTEXT_TTL = 60;

type Provider = "GOOGLE" | "GITHUB" | "EMAIL";

export interface AppAuthContext {
  appUserId: string;
  role: string;
  email: string;
  clerkUserId: string;
  clerkSessionId: string;
  organizationId: string | null;
  organizationSlug: string | null;
  // NEW
  planId: "FREE" | "STANDARD" | "PRO";
  subscriptionStatus: string;
  // NEW
  effectivePlanId: "FREE" | "STANDARD" | "PRO"; // Personal OR inherited from org
  orgId: string | null; // Our Organisation.id
  orgRole: OrgMemberRole | null;
  isOrgOwner: boolean;
  isOrgMember: boolean; // true = active member of a live PRO org
}

interface RequireAuthContextOptions {
  request?: Request;
  eventType?: string;
  allowPendingSession?: boolean;
}

type SessionClaims = {
  iat?: number;
  exp?: number;
  sts?: string;
  o?: {
    id?: string;
    slg?: string;
  };
};

export class AuthError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "AuthError";
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTH_REQUIRED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "Forbidden") {
    super(message, 403, "AUTH_FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

function parseJwtTimestamp(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed * 1000);
    }
  }

  return null;
}

function getRequestHeader(
  request: Request | undefined,
  headerName: string,
): string | null {
  if (!request) {
    return null;
  }

  const value = request.headers.get(headerName);
  return value && value.trim().length > 0 ? value : null;
}

function getClientIpAddress(request: Request | undefined): string | null {
  const forwardedFor = getRequestHeader(request, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return getRequestHeader(request, "x-real-ip");
}

function getRequestPath(request: Request | undefined): string | null {
  if (!request) {
    return null;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}

function extractPrimaryEmail(clerkUser: unknown): string | null {
  const user = clerkUser as Record<string, unknown> | null | undefined;
  const primaryId =
    (user?.primaryEmailAddressId as string | undefined) ??
    (user?.primary_email_address_id as string | undefined);
  const addresses =
    (user?.emailAddresses as unknown[] | undefined) ??
    (user?.email_addresses as unknown[] | undefined);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return null;
  }

  if (primaryId) {
    const primary = addresses.find(
      (address: unknown) =>
        (
          (address as Record<string, unknown>)?.id ??
          (address as Record<string, unknown>)?.emailAddressId ??
          (address as Record<string, unknown>)?.email_address_id
        ) === primaryId,
    );

    const primaryEmail =
      ((primary as Record<string, unknown>)?.emailAddress as
        | string
        | undefined) ??
      ((primary as Record<string, unknown>)?.email_address as
        | string
        | undefined);
    if (typeof primaryEmail === "string" && primaryEmail.length > 0) {
      return primaryEmail;
    }
  }

  const firstAddress = addresses[0] as Record<string, unknown> | undefined;
  const fallback =
    (firstAddress?.emailAddress as string | undefined) ??
    (firstAddress?.email_address as string | undefined);
  return typeof fallback === "string" && fallback.length > 0 ? fallback : null;
}

function extractDisplayName(
  clerkUser: unknown,
  fallbackEmail: string,
): string {
  const user = clerkUser as Record<string, unknown> | null | undefined;
  const firstName =
    (user?.firstName as string | undefined) ??
    (user?.first_name as string | undefined);
  const lastName =
    (user?.lastName as string | undefined) ??
    (user?.last_name as string | undefined);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName.length > 0) {
    return fullName;
  }

  const username = user?.username;
  if (typeof username === "string" && username.length > 0) {
    return username;
  }

  return fallbackEmail.split("@")[0] ?? "User";
}

function inferProvider(clerkUser: unknown): Provider {
  const user = clerkUser as Record<string, unknown> | null | undefined;
  const accounts =
    (user?.externalAccounts as unknown[] | undefined) ??
    (user?.external_accounts as unknown[] | undefined);

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return "EMAIL";
  }

  const firstAccount = accounts[0] as Record<string, unknown> | undefined;
  const provider = String(
    firstAccount?.provider ??
      firstAccount?.providerName ??
      firstAccount?.identificationType ??
      "",
  ).toLowerCase();

  if (provider.includes("google")) {
    return "GOOGLE";
  }

  if (provider.includes("github")) {
    return "GITHUB";
  }

  return "EMAIL";
}

function extractOrganizationClaims(sessionClaims: SessionClaims | null): {
  organizationId: string | null;
  organizationSlug: string | null;
} {
  const organizationClaim = sessionClaims?.o;

  return {
    organizationId: organizationClaim?.id ?? null,
    organizationSlug: organizationClaim?.slg ?? null,
  };
}

async function fetchClerkUser(clerkUserId: string): Promise<unknown | null> {
  try {
    const clerkClient = await getClerkClient();
    return await clerkClient.users.getUser(clerkUserId);
  } catch (error) {
    logger.warn("Failed to fetch Clerk user for auth context", {
      clerkUserId,
      error: String(error),
    });
    return null;
  }
}

export async function invalidateAuthContextCache(
  clerkSessionId: string,
): Promise<void> {
  await redis.del(`auth:context:${clerkSessionId}`);
}

export async function requireAuthContext(
  options: RequireAuthContextOptions = {},
): Promise<AppAuthContext> {
  const authState = await auth();
  const sessionClaims = (authState.sessionClaims ??
    null) as SessionClaims | null;
  if (!authState.userId) {
    throw new UnauthorizedError();
  }

  if (!authState.sessionId) {
    throw new UnauthorizedError("Authenticated session is missing");
  }

  if (!options.allowPendingSession && sessionClaims?.sts === "pending") {
    throw new ForbiddenError("Session is pending completion");
  }

  const clerkUserId = authState.userId;
  const clerkSessionId = authState.sessionId;

  // Try cache first
  const cached = await redis.get<AppAuthContext>(
    `auth:context:${clerkSessionId}`,
  );
  if (cached) {
    return cached;
  }

  const clerkUser = await getCachedClerkUser(clerkUserId);

  const fallbackEmail = `${clerkUserId}@${EMAIL_FALLBACK_DOMAIN}`;
  const clerkEmail = extractPrimaryEmail(clerkUser);
  const resolvedEmail = clerkEmail ?? fallbackEmail;
  const hasClerkProfileData = Boolean(clerkUser && clerkEmail);
  const profileName = extractDisplayName(clerkUser, resolvedEmail);
  const profileProvider = inferProvider(clerkUser);
  const { organizationId, organizationSlug } =
    extractOrganizationClaims(sessionClaims);

  const existingByClerkUserId = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true, role: true },
  });

  const existingByEmailWithoutClerkUserId =
    !existingByClerkUserId && clerkEmail
      ? await prisma.user.findFirst({
          where: {
            email: clerkEmail,
            clerkUserId: null,
          },
          select: { id: true, email: true, role: true },
        })
      : null;

  const user = existingByClerkUserId
    ? await prisma.user.update({
        where: {
          id: existingByClerkUserId.id,
        },
        data: {
          clerkUserId,
          organizationId,
          organizationSlug,
          isActive: true,
          ...(hasClerkProfileData
            ? {
                email: resolvedEmail,
                name: profileName,
                provider: profileProvider,
              }
            : {}),
        },
      })
    : existingByEmailWithoutClerkUserId
      ? await prisma.user.update({
          where: {
            id: existingByEmailWithoutClerkUserId.id,
          },
          data: {
            clerkUserId,
            organizationId,
            organizationSlug,
            isActive: true,
            ...(hasClerkProfileData
              ? {
                  email: resolvedEmail,
                  name: profileName,
                  provider: profileProvider,
                }
              : {}),
          },
        })
      : await prisma.user.create({
          data: {
            clerkUserId,
            email: resolvedEmail,
            name: profileName,
            provider: hasClerkProfileData ? profileProvider : "EMAIL",
            organizationId,
            organizationSlug,
            isActive: true,
          },
        });

  const now = new Date();
  const issuedAt = parseJwtTimestamp(sessionClaims?.iat) ?? now;
  const expiresAt = parseJwtTimestamp(sessionClaims?.exp);
  const ipAddress = getClientIpAddress(options.request);
  const userAgent = getRequestHeader(options.request, "user-agent");

  await prisma.appSession.upsert({
    where: {
      clerkSessionId,
    },
    create: {
      userId: user.id,
      clerkSessionId,
      status: "ACTIVE",
      issuedAt,
      expiresAt: expiresAt ?? undefined,
      lastActiveAt: now,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    },
    update: {
      userId: user.id,
      status: "ACTIVE",
      expiresAt: expiresAt ?? undefined,
      lastActiveAt: now,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });

  await prisma.authAuditEvent
    .create({
      data: {
        userId: user.id,
        clerkUserId,
        clerkSessionId,
        eventType: options.eventType ?? "request.authenticated",
        eventSource: "REQUEST",
        metadata: {
          path: getRequestPath(options.request),
          method: options.request?.method ?? null,
          ipAddress,
          userAgent,
        },
      },
    })
    .catch((err) => {
      logger.warn("Audit event write failed (non-fatal)", err);
    });

  // Auto-provision or load subscription — single indexed @unique lookup
  const subscription = await getCachedSubscription(user.id);

  const hasOrgHistory =
    user.role !== "USER" ||
    (await redis.get<boolean>(`auth:has-org:${user.id}`));

  let orgMembership = null;

  // Check if this user is an ACTIVE member of an org whose owner has an ACTIVE PRO subscription
  if (hasOrgHistory !== false) {
    // skip if explicitly cached as false
    orgMembership = await prisma.orgMembership.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        role: true,
        organisationId: true,
        organisation: {
          select: {
            id: true,
            ownerId: true,
            maxSeats: true,
            owner: {
              select: {
                subscription: {
                  select: { planId: true, status: true },
                },
              },
            },
          },
        },
      },
    });
    if (!orgMembership) {
      // Cache the negative result for 5 minutes to avoid repeated lookups
      await redis.setex(`auth:has-org:${user.id}`, 300, false);
    } else {
      await redis.setex(`auth:has-org:${user.id}`, 60, true);
    }
  }

  const orgOwnerSub = orgMembership?.organisation?.owner?.subscription;
  const orgIsLive =
    !!orgOwnerSub &&
    orgOwnerSub.planId === "PRO" &&
    ["ACTIVE", "AUTHENTICATED", "TRIALING"].includes(orgOwnerSub.status);

  const personalPlanId = subscription.planId as "FREE" | "STANDARD" | "PRO";
  const effectivePlanId = orgIsLive ? "PRO" : personalPlanId;

  const context: AppAuthContext = {
    appUserId: user.id,
    role: user.role,
    email: user.email,
    clerkUserId,
    clerkSessionId,
    organizationId: user.organizationId,
    organizationSlug: user.organizationSlug,
    planId: subscription.planId as "FREE" | "STANDARD" | "PRO",
    subscriptionStatus: subscription.status,
    effectivePlanId,
    orgId: orgMembership?.organisationId ?? null,
    orgRole: (orgMembership?.role as OrgMemberRole) ?? null,
    isOrgOwner: orgMembership?.role === "OWNER",
    isOrgMember: orgIsLive && !!orgMembership,
  };

  await redis.setex(
    `auth:context:${clerkSessionId}`,
    AUTH_CONTEXT_TTL,
    context,
  );

  return context;
}

async function getCachedClerkUser(
  clerkUserId: string,
): Promise<unknown | null> {
  const cached = await redis.get<unknown>(`auth:clerk-user:${clerkUserId}`);
  if (cached) return cached;
  const clerkClient = await getClerkClient();
  const user = await clerkClient.users.getUser(clerkUserId);
  await redis.setex(`auth:clerk-user:${clerkUserId}`, CLERK_USER_TTL, user);
  return user;
}

async function getCachedSubscription(userId: string) {
  const cached = await redis.get<{
    planId: string;
    status: string;
    cancelAtPeriodEnd: boolean;
  }>(`auth:subscription:${userId}`);
  if (cached) return cached;
  const sub = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: "FREE",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    },
    update: {},
    select: { planId: true, status: true, cancelAtPeriodEnd: true },
  });
  await redis.setex(`auth:subscription:${userId}`, SUBSCRIPTION_TTL, sub);
  return sub;
}
