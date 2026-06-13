import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

const redis = Redis.fromEnv();

const bodySchema = z.object({
  ownerId: z.string(),
});

async function invalidateMemberAuthCaches(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const sessions = await prisma.appSession
    .findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { clerkSessionId: true },
      take: 250,
    })
    .catch(() => []);
  if (sessions.length === 0) return;
  await redis
    .del(...sessions.map((s) => `auth:context:${s.clerkSessionId}`))
    .catch(() => {});
}

export const POST = verifySignatureAppRouter(async (req: Request) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Request body must be valid JSON",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid payload",
          issues: parsedBody.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { ownerId } = parsedBody.data;

    const org = await prisma.organisation.findUnique({
      where: { ownerId },
      select: { id: true, name: true },
    });

    if (!org) {
      logger.info("Org cleanup skipped — already removed", { ownerId });
      return new Response(
        JSON.stringify({ success: true, message: "Org already removed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const members = await prisma.orgMembership.findMany({
      where: { organisationId: org.id, status: "ACTIVE" },
      select: { userId: true, user: { select: { email: true, name: true } } },
    });

    await prisma.orgMembership.deleteMany({
      where: { organisationId: org.id },
    });

    await prisma.orgInvitation.updateMany({
      where: { organisationId: org.id, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    await prisma.organisation.delete({
      where: { id: org.id },
    });

    await invalidateMemberAuthCaches(members.map((m) => m.userId));

    const queueBaseUrl = process.env.BACKGROUND_TASK_QUEUE_PUBLIC_URL;
    if (queueBaseUrl) {
      const qstash = new Client({ token: process.env.QSTASH_TOKEN });
      for (const member of members) {
        if (member.userId === ownerId) continue;
        if (!member.user.email) continue;
        await qstash
          .publishJSON({
            url: `${queueBaseUrl}/api/background-jobs/org-cleanup-notification`,
            body: { email: member.user.email, orgName: org.name },
          })
          .catch((err) =>
            logger.warn("Failed to enqueue org-cleanup notification", {
              userId: member.userId,
              error: String(err),
            }),
          );
      }
    }

    logger.info("Org cleaned up successfully", {
      orgId: org.id,
      ownerId,
      membersCleaned: members.length,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    logger.error("Org cleanup failed", { error });
    return new Response(
      JSON.stringify({ success: false, message: "Org cleanup failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
