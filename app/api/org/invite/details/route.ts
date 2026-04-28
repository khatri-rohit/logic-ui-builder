import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.nextUrl);
  const token = searchParams.get("token");
  logger.info("Received request for invitation details with token:", token);

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    // In a real implementation, you would verify the token and fetch details from your database
    const invitationDetails = await prisma.orgInvitation.findUnique({
      where: { token },
      select: {
        organisation: {
          select: {
            name: true,
          },
        },
        role: true,
        inviter: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!invitationDetails) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        invitedBy: invitationDetails.inviter.email,
        orgName: invitationDetails.organisation.name,
        role: invitationDetails.role,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error fetching invitation details:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitation details" },
      { status: 500 },
    );
  }
}
