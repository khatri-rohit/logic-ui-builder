import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";

export async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.listed",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        {
          error: true,
          message: "Unauthorized: Missing user ID in auth context",
          data: null,
        },
        { status: 401 },
      );
    }

    const rawProjects = await prisma.project.findMany({
      where: {
        userId: authContext.appUserId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        status: true,
        platform: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const projects = rawProjects.map((p) => ({
      ...p,
      platform: p.platform === "MOBILE" ? "mobile" : "web",
    }));

    return NextResponse.json(
      {
        error: false,
        data: projects,
        message: "Projects retrieved successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        {
          error: true,
          code: error.code,
          message: error.message,
          data: null,
        },
        { status: error.status },
      );
    }

    logger.error("Error fetching projects:", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while fetching projects.",
        data: null,
      },
      { status: 500 },
    );
  }
}
