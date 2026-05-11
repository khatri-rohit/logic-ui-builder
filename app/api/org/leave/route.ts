import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { leaveOrganisation, isOrgError } from "@/lib/org";
import { orgRatelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.member.left",
    });

    const { success } = await orgRatelimit.limit(
      `org-leave:${authContext.appUserId}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: true, message: "Too many requests." },
        { status: 429 },
      );
    }

    if (!authContext.orgId) {
      return NextResponse.json(
        { error: true, message: "You are not in an organisation." },
        { status: 404 },
      );
    }

    await leaveOrganisation(authContext.orgId, authContext.appUserId);

    return NextResponse.json({
      error: false,
      message:
        "You have left the organisation. Your plan has reverted to your personal subscription.",
    });
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
      { error: true, message: "Failed to leave organisation." },
      { status: 500 },
    );
  }
}
