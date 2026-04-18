import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type UserJSON, type WebhookEvent } from "@clerk/nextjs/server";

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/browser";
import { z } from "zod";

export const runtime = "nodejs";

type Provider = "GOOGLE" | "GITHUB" | "EMAIL";
type SessionStatus = "ACTIVE" | "ENDED" | "REVOKED";

const nonEmptyStringSchema = z.string().trim().min(1);

const deletedUserWebhookDataSchema = z.object({
  id: nonEmptyStringSchema,
});

const sessionWebhookDataSchema = z.object({
  id: nonEmptyStringSchema,
  user_id: nonEmptyStringSchema,
  created_at: z.union([z.number(), z.string()]).optional(),
  expire_at: z.union([z.number(), z.string()]).optional(),
});

function timestampToDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function extractPrimaryEmail(userData: UserJSON, clerkUserId: string): string {
  const primaryId = userData.primary_email_address_id;
  const addresses = userData.email_addresses;

  if (Array.isArray(addresses) && addresses.length > 0) {
    if (primaryId) {
      const primary = addresses.find(
        (address: UserJSON["email_addresses"][0]) => address.id === primaryId,
      );
      const primaryEmail = primary?.email_address;
      if (typeof primaryEmail === "string" && primaryEmail.length > 0) {
        return primaryEmail;
      }
    }

    const fallback = addresses[0]?.email_address;
    if (typeof fallback === "string" && fallback.length > 0) {
      return fallback;
    }
  }

  return `${clerkUserId}@clerk.local`;
}

function extractDisplayName(userData: UserJSON, email: string): string {
  const firstName = userData.first_name;
  const lastName = userData.last_name;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName.length > 0) {
    return fullName;
  }

  const username = userData.username;
  if (typeof username === "string" && username.length > 0) {
    return username;
  }

  return email.split("@")[0] ?? "User";
}

function inferProvider(
  externalAccounts: UserJSON["external_accounts"],
): Provider {
  if (!Array.isArray(externalAccounts) || externalAccounts.length === 0) {
    return "EMAIL";
  }

  const provider = String(externalAccounts[0].provider ?? "").toLowerCase();

  if (provider.includes("google") || provider.includes("oauth_google")) {
    return "GOOGLE";
  }
  if (provider.includes("github") || provider.includes("oauth_github")) {
    return "GITHUB";
  }

  return "EMAIL";
}

function mapSessionEventToStatus(eventType: string): SessionStatus | null {
  if (eventType === "session.created") {
    return "ACTIVE";
  }

  if (eventType === "session.ended") {
    return "ENDED";
  }

  if (eventType === "session.revoked") {
    return "REVOKED";
  }

  return null;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as { code?: string }).code === "P2002";
}

async function upsertUserFromWebhookData(
  tx: Prisma.TransactionClient,
  userData: UserJSON,
) {
  const parsedClerkUserId = nonEmptyStringSchema.safeParse(userData.id);
  if (!parsedClerkUserId.success) {
    return null;
  }

  const clerkUserId = parsedClerkUserId.data;

  const email = extractPrimaryEmail(userData, clerkUserId);
  const name = extractDisplayName(userData, email);
  const provider = inferProvider(userData.external_accounts);

  try {
    return await tx.user.upsert({
      where: {
        clerkUserId,
      },
      create: {
        clerkUserId,
        email,
        name,
        provider,
        isActive: true,
      },
      update: {
        email,
        name,
        provider,
        isActive: true,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existingByEmail = await tx.user.findUnique({
      where: {
        email,
      },
    });

    if (!existingByEmail) {
      throw error;
    }

    if (
      existingByEmail.clerkUserId &&
      existingByEmail.clerkUserId !== clerkUserId
    ) {
      logger.warn("Skipping Clerk user relink due email collision", {
        email,
        incomingClerkUserId: clerkUserId,
        existingClerkUserId: existingByEmail.clerkUserId,
      });

      return await tx.user.update({
        where: {
          id: existingByEmail.id,
        },
        data: {
          name,
          provider,
          isActive: true,
        },
      });
    }

    return await tx.user.update({
      where: {
        id: existingByEmail.id,
      },
      data: {
        clerkUserId,
        email,
        name,
        provider,
        isActive: true,
      },
    });
  }
}

async function ensureUserForSession(
  tx: Prisma.TransactionClient,
  clerkUserId: string,
) {
  const fallbackEmail = `${clerkUserId}@clerk.local`;

  return await tx.user.upsert({
    where: {
      clerkUserId,
    },
    create: {
      clerkUserId,
      email: fallbackEmail,
      name: fallbackEmail.split("@")[0] ?? "User",
      provider: "EMAIL",
      isActive: true,
    },
    update: {},
  });
}

export async function POST(req: NextRequest) {
  try {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      logger.error(
        "Missing Clerk webhook signing secret. Set CLERK_WEBHOOK_SIGNING_SECRET (or CLERK_WEBHOOK_SECRET).",
      );

      return NextResponse.json(
        {
          error: true,
          message: "Webhook signing secret is not configured",
        },
        { status: 500 },
      );
    }

    const evt: WebhookEvent = await verifyWebhook(req, {
      signingSecret,
    });
    const webhookMessageId =
      req.headers.get("svix-id") ??
      `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    logger.info("Received Clerk webhook", {
      webhookMessageId,
      eventType: evt.type,
    });

    const transactionResult = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const insertedWebhookEvent = await tx.clerkWebhookEvent.createMany({
          data: [
            {
              id: webhookMessageId,
              eventType: evt.type,
            },
          ],
          skipDuplicates: true,
        });

        if (insertedWebhookEvent.count === 0) {
          return { duplicate: true };
        }

        if (evt.type === "user.created" || evt.type === "user.updated") {
          await upsertUserFromWebhookData(tx, evt.data);
        }

        if (evt.type === "user.deleted") {
          const parsedDeletedUser = deletedUserWebhookDataSchema.safeParse(
            evt.data,
          );
          if (parsedDeletedUser.success) {
            const clerkUserId = parsedDeletedUser.data.id;
            // Soft delete the user in our database to preserve historical data and relations, but mark them as inactive
            // await tx.user.updateMany({
            //   where: {
            //     clerkUserId,
            //   },
            //   data: {
            //     isActive: false,
            //   },
            // });
            await tx.user.deleteMany({
              where: {
                clerkUserId,
              },
            });

            // Delete the user from clerk users management as well, since the user.deleted event can be triggered by external deletion from clerk dashboard or API
            // const { users } = await clerkClient();
            // await users.deleteUser(clerkUserId);
          }
        }

        if (
          evt.type === "session.created" ||
          evt.type === "session.ended" ||
          evt.type === "session.revoked"
        ) {
          const parsedSessionData = sessionWebhookDataSchema.safeParse(
            evt.data,
          );
          const status = mapSessionEventToStatus(evt.type);

          if (parsedSessionData.success && status) {
            const sessionData = parsedSessionData.data;
            const clerkSessionId = sessionData.id;
            const clerkUserId = sessionData.user_id;
            const user = await ensureUserForSession(tx, clerkUserId);
            const issuedAt =
              timestampToDate(sessionData?.created_at) ?? new Date();
            const expiresAt = timestampToDate(sessionData?.expire_at);

            await tx.appSession.upsert({
              where: {
                clerkSessionId,
              },
              create: {
                userId: user.id,
                clerkSessionId,
                status,
                issuedAt,
                expiresAt: expiresAt ?? undefined,
                lastActiveAt: new Date(),
              },
              update: {
                userId: user.id,
                status,
                expiresAt: expiresAt ?? undefined,
                lastActiveAt: new Date(),
              },
            });

            await tx.authAuditEvent.create({
              data: {
                userId: user.id,
                clerkUserId,
                clerkSessionId,
                eventType: evt.type,
                eventSource: "WEBHOOK",
                metadata: {
                  webhookEventId: webhookMessageId,
                  webhookType: evt.type,
                },
              },
            });
          }
        }

        return { duplicate: false };
      },
    );

    if (transactionResult.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to process Clerk webhook", error);
    return NextResponse.json(
      {
        error: true,
        message: "Invalid or failed Clerk webhook processing",
      },
      { status: 400 },
    );
  }
}
