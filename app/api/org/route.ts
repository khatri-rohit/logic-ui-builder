import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import {
  createOrganisation,
  getActiveSeatCount,
  isOrgError,
  OrgError,
} from "@/lib/org";
import { guardOrgCreation } from "@/lib/plan-guard";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

const createBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.fetched",
    });

    if (!authContext.orgId) {
      return NextResponse.json({ error: false, data: null });
    }

    const org = await prisma.organisation.findUnique({
      where: { id: authContext.orgId },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
        invitations: {
          where: { status: "PENDING", expiresAt: { gt: new Date() } },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!org) {
      logger.error("Organisation not found", { org, orgId: authContext.orgId });
      return NextResponse.json({ error: false, data: null }, { status: 404 });
    }

    const seatCount = await getActiveSeatCount(authContext.orgId);

    return NextResponse.json({
      error: false,
      data: {
        ...org,
        seatCount,
        userRole: authContext.orgRole,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch organisation", { error });
    if (isAuthError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: true, message: "Failed to fetch organisation." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.created",
    });

    const guardResult = await guardOrgCreation(authContext);
    if (!guardResult.allowed) return guardResult.response;

    const rawBody = await req.json().catch(() => null);
    const body = createBodySchema.safeParse(rawBody);
    if (!body.success)
      return NextResponse.json(
        { error: true, message: "Invalid payload." },
        { status: 400 },
      );

    const org = await createOrganisation({
      ownerId: authContext.appUserId,
      name: body.data.name,
    });

    return NextResponse.json({ error: false, data: org }, { status: 201 });
  } catch (error) {
    logger.error("Failed to create organisation", { error });
    if (isAuthError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    if (isOrgError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: true, message: "Failed to create organisation." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.dissolved",
    });
    if (!authContext.orgId || !authContext.isOrgOwner) {
      return NextResponse.json(
        {
          error: true,
          message: "Only the organisation owner can dissolve it.",
        },
        { status: 403 },
      );
    }
    const { dissolveOrganisation } = await import("@/lib/org");
    await dissolveOrganisation(authContext.orgId, authContext.appUserId);
    return NextResponse.json({
      error: false,
      message: "Organisation dissolved.",
    });
  } catch (error) {
    logger.error("Failed to dissolve organisation", { error });
    if (isAuthError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    if (isOrgError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: true, message: "Failed to dissolve organisation." },
      { status: 500 },
    );
  }
}
