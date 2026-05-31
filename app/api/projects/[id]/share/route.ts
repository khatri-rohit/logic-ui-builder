import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import {
  projectRouteParamsSchema,
  toValidationIssues,
} from "@/lib/schemas/studio";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.share_toggled",
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

    const parsedParams = projectRouteParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project route parameters",
          issues: toValidationIssues(parsedParams.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { id } = parsedParams.data;

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
      select: {
        id: true,
        isPublic: true,
        shareToken: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          error: true,
          message: "Project not found",
          data: null,
        },
        { status: 404 },
      );
    }

    const nextIsPublic = !project.isPublic;
    const nextShareToken = nextIsPublic
      ? randomBytes(24).toString("hex")
      : null;

    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        isPublic: nextIsPublic,
        shareToken: nextShareToken,
      },
      select: {
        id: true,
        isPublic: true,
        shareToken: true,
      },
    });

    return NextResponse.json(
      {
        error: false,
        message: nextIsPublic
          ? "Public sharing enabled"
          : "Public sharing disabled",
        data: {
          isPublic: updatedProject.isPublic,
          shareToken: updatedProject.shareToken,
        },
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
        },
        { status: error.status },
      );
    }

    logger.error("Error toggling project share:", { error });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while toggling project sharing",
        data: null,
      },
      { status: 500 },
    );
  }
}
