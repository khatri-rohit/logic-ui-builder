import { NextResponse } from "next/server";

import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import { apiRatelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "signout.initiated",
      allowPendingSession: true,
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        {
          error: true,
          message: "Unauthorized: Missing user ID in auth context",
        },
        { status: 401 },
      );
    }

    const { success, limit, remaining, reset } = await apiRatelimit.limit(
      `logout-audit:${authContext.appUserId}`,
    );

    if (!success) {
      return NextResponse.json(
        {
          error: true,
          message: "Rate limit exceeded",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        {
          error: true,
          code: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    logger.error("Failed to create logout audit event", error);

    return NextResponse.json(
      {
        error: true,
        message: "Failed to create logout audit event",
      },
      { status: 500 },
    );
  }
}
