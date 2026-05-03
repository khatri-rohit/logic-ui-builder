import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { acceptInvitation, isOrgError } from "@/lib/org";
import { apiRatelimit } from "@/lib/ratelimit";
import logger from "@/lib/logger";

const bodySchema = z.object({ token: z.string().min(64).max(64) });

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "org.invite.accepted",
    });

    const { success, limit, remaining, reset } = await apiRatelimit.limit(
      `org-invite-accept:${authContext.appUserId}`,
    );
    logger.info("Rate limit check for org invite acceptance", {
      appUserId: authContext.appUserId,
      success,
      limit,
      remaining,
      reset,
    });
    if (!success) {
      return NextResponse.json(
        { error: true, message: "Too many invitation accept attempts." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = bodySchema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(
        { error: true, message: "Invalid token." },
        { status: 400 },
      );

    const membership = await acceptInvitation(
      body.data.token,
      authContext.appUserId,
    );

    return NextResponse.json({
      error: false,
      message: "You have joined the organisation. Pro features are now active.",
      data: { membershipId: membership.id, role: membership.role },
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
      { error: true, message: "Failed to accept invitation." },
      { status: 500 },
    );
  }
}
