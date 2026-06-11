import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { toValidationIssues } from "@/lib/schemas/studio";

const paramsSchema = z.object({
  id: z.string().min(1),
  frameId: z.string().min(1),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; frameId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "frame.history.fetched",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized", data: null },
        { status: 401 },
      );
    }

    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid route parameters",
          issues: toValidationIssues(parsedParams.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { id, frameId } = parsedParams.data;

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: true, message: "Project not found", data: null },
        { status: 404 },
      );
    }

    const versions = await prisma.frameVersion.findMany({
      where: { projectId: id, frameId },
      orderBy: { versionNumber: "desc" },
      select: {
        versionNumber: true,
        content: true,
        editedContent: true,
        prompt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Frame history fetched successfully",
        data: { versions },
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

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while fetching frame history",
        data: null,
      },
      { status: 500 },
    );
  }
}
