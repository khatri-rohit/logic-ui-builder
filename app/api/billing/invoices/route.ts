import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "billing.invoices.fetched",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Unauthorized. Authentication is required to access this endpoint.",
        },
        { status: 401 },
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId: authContext.appUserId },
      orderBy: { paidAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      {
        error: false,
        message: "Invoices retrieved successfully.",
        data: invoices,
      },
      { status: 200 },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { error: true, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    logger.error("GET /api/billing/invoices failed", { error });
    return NextResponse.json(
      {
        error: true,
        message: "An unexpected error occurred.",
      },
      { status: 500 },
    );
  }
}
