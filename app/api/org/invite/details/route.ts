import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuthContext({
      request,
      eventType: "org.invite.details.viewed",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: true, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.nextUrl);
  const token = searchParams.get("token");

  if (!token || token.length !== 64) {
    return NextResponse.json(
      { error: true, message: "Invalid token" },
      { status: 400 },
    );
  }

  try {
    const invitationDetails = await prisma.orgInvitation.findUnique({
      where: { token },
      select: {
        organisation: { select: { name: true } },
        role: true,
        inviter: { select: { email: true } },
        expiresAt: true,
        status: true,
      },
    });

    if (!invitationDetails || invitationDetails.status !== "PENDING") {
      return NextResponse.json(
        {
          error: true,
          message: !invitationDetails
            ? "Invitation not found"
            : "Invitation is not pending",
        },
        { status: 404 },
      );
    }

    if (invitationDetails.expiresAt < new Date()) {
      return NextResponse.json(
        { error: true, message: "Invitation expired" },
        { status: 410 },
      );
    }

    return NextResponse.json({
      invitedBy: invitationDetails.inviter?.email ?? null,
      orgName: invitationDetails.organisation.name,
      role: invitationDetails.role,
    });
  } catch (error) {
    logger.error("Error fetching invitation details:", error);
    return NextResponse.json(
      {
        error: true,
        message: "Failed to fetch invitation details",
      },
      { status: 500 },
    );
  }
}
