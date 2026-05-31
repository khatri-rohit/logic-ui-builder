import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { removeMember, isOrgError } from "@/lib/org";
import { orgRatelimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.member.removed",
    });

    const { success } = await orgRatelimit.limit(
      `org-remove:${authContext.appUserId}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: true, message: "Too many requests." },
        { status: 429 },
      );
    }

    const { memberId } = await params;

    if (!authContext.orgId) {
      return NextResponse.json(
        { error: true, message: "You do not belong to an organisation." },
        { status: 404 },
      );
    }

    // Resolve memberId → userId
    const membership = await prisma.orgMembership.findUnique({
      where: { id: memberId },
      select: { userId: true, organisationId: true },
    });

    if (!membership || membership.organisationId !== authContext.orgId) {
      return NextResponse.json(
        { error: true, message: "Member not found." },
        { status: 404 },
      );
    }

    await removeMember(
      authContext.orgId,
      membership.userId,
      authContext.appUserId,
    );

    return NextResponse.json({ error: false, message: "Member removed." });
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
      { error: true, message: "Failed to remove member." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.member.role.updated",
    });

    const { success } = await orgRatelimit.limit(
      `org-role:${authContext.appUserId}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: true, message: "Too many requests." },
        { status: 429 },
      );
    }

    const { memberId } = await params;

    if (!authContext.isOrgOwner) {
      return NextResponse.json(
        { error: true, message: "Only the owner can change member roles." },
        { status: 403 },
      );
    }

    const body = z
      .object({ role: z.enum(["ADMIN", "MEMBER"]) })
      .safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(
        { error: true, message: "Invalid role." },
        { status: 400 },
      );

    const updated = await prisma.orgMembership.update({
      where: { id: memberId },
      data: { role: body.data.role },
      select: { id: true, role: true },
    });

    return NextResponse.json({ error: false, data: updated });
  } catch (error) {
    if (isAuthError(error))
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: true, message: "Failed to update member role." },
      { status: 500 },
    );
  }
}
