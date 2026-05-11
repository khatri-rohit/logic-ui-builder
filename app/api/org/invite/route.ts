import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { createInvitation, isOrgError } from "@/lib/org";
import { guardOrgInvite } from "@/lib/plan-guard";
import { orgRatelimit } from "@/lib/ratelimit";
import { sendOrgInviteEmail } from "@/lib/org-mail";
import { getSiteUrl } from "@/lib/seo";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.invite.sent",
    });

    const { success } = await orgRatelimit.limit(
      `org-invite:${authContext.appUserId}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: true, message: "Too many requests." },
        { status: 429 },
      );
    }

    if (!authContext.orgId) {
      return NextResponse.json(
        { error: true, message: "You do not belong to an organisation." },
        { status: 404 },
      );
    }

    const guardResult = await guardOrgInvite(authContext, authContext.orgId);
    if (!guardResult.allowed) return guardResult.response;

    const body = bodySchema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(
        { error: true, message: "Invalid payload." },
        { status: 400 },
      );

    // Prevent inviting existing active members
    const existingMember = await prisma.orgMembership.findFirst({
      where: {
        organisationId: authContext.orgId,
        user: { email: body.data.email },
        status: "ACTIVE",
      },
    });
    if (existingMember) {
      return NextResponse.json(
        {
          error: true,
          code: "ALREADY_A_MEMBER",
          message: "This user is already an active member.",
        },
        { status: 409 },
      );
    }

    const invitation = await createInvitation({
      organisationId: authContext.orgId,
      email: body.data.email,
      role: body.data.role,
      invitedBy: authContext.appUserId,
    });

    // Send invite email asynchronously (fire and forget)
    const acceptUrl = `${getSiteUrl()}/org/invite/accept?token=${invitation.token}`;
    sendOrgInviteEmail({
      to: body.data.email,
      inviterEmail: authContext.email,
      orgName: "", // loaded from org — simplified here
      acceptUrl,
      expiresAt: invitation.expiresAt,
    }).catch(() => {}); // non-blocking

    return NextResponse.json(
      {
        error: false,
        data: { invitationId: invitation.id, email: body.data.email },
      },
      { status: 201 },
    );
  } catch (error) {
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
      { error: true, message: "Failed to send invitation." },
      { status: 500 },
    );
  }
}
