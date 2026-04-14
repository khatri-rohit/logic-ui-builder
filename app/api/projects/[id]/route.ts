import { Prisma } from "@/app/generated/prisma/client";
import { isCanvasSnapshotV1 } from "@/lib/canvas-state";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.fetched",
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          error: true,
          message: "Project ID is required",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
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

    const normalizedCanvasState = isCanvasSnapshotV1(project.canvasState)
      ? project.canvasState
      : null;

    return NextResponse.json(
      {
        error: false,
        message: "Project fetched successfully",
        data: {
          id: project.id,
          title: project.title ?? "Untitled Project",
          status: project.status,
          initialPrompt: project.initialPrompt,
          canvasState: normalizedCanvasState,
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
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while fetching the project",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}
const ProjectStatus = ["PENDING", "GENERATING", "ACTIVE", "ARCHIVED"] as const;
type ProjectStatusValue = (typeof ProjectStatus)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.updated",
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          error: true,
          message: "Project ID is required",
          data: null,
        },
        { status: 400 },
      );
    }

    let body: {
      status?: unknown;
      canvasState?: unknown;
    };

    try {
      body = (await req.json()) as {
        status?: unknown;
        canvasState?: unknown;
      };
    } catch {
      return NextResponse.json(
        {
          error: true,
          message: "Request body must be valid JSON",
          data: null,
        },
        { status: 400 },
      );
    }

    const { status, canvasState } = body;

    if (status === undefined && canvasState === undefined) {
      return NextResponse.json(
        {
          error: true,
          message: "Either status or canvasState must be provided",
          data: null,
        },
        { status: 400 },
      );
    }

    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !ProjectStatus.includes(status as ProjectStatusValue))
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid status value",
          data: null,
        },
        { status: 400 },
      );
    }

    if (
      canvasState !== undefined &&
      canvasState !== null &&
      !isCanvasSnapshotV1(canvasState)
    ) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid canvasState payload",
          data: null,
        },
        { status: 400 },
      );
    }

    const canvasStateSnapshot =
      canvasState !== undefined &&
      canvasState !== null &&
      isCanvasSnapshotV1(canvasState)
        ? canvasState
        : null;

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
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

    if (canvasStateSnapshot) {
      const incomingSavedAtMs = Date.parse(canvasStateSnapshot.savedAt);
      if (Number.isNaN(incomingSavedAtMs)) {
        return NextResponse.json(
          {
            error: true,
            message: "Invalid canvasState savedAt value",
            data: null,
          },
          { status: 400 },
        );
      }

      if (isCanvasSnapshotV1(project.canvasState)) {
        const persistedSavedAtMs = Date.parse(project.canvasState.savedAt);
        if (
          !Number.isNaN(persistedSavedAtMs) &&
          incomingSavedAtMs <= persistedSavedAtMs
        ) {
          return NextResponse.json(
            {
              error: true,
              message: "Stale canvasState payload rejected",
              data: null,
            },
            { status: 409 },
          );
        }
      }
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    if (status !== undefined) {
      updateData.status = status as ProjectStatusValue;
    }

    if (canvasState !== undefined) {
      updateData.canvasState =
        canvasState === null
          ? Prisma.JsonNull
          : (canvasStateSnapshot as unknown as Prisma.InputJsonValue);
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        status: true,
        canvasState: true,
      },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Project updated successfully",
        data: {
          status: updatedProject.status,
          canvasState: updatedProject.canvasState,
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
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while updating the project status",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "project.deleted",
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          error: true,
          message: "Project ID is required",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
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
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        error: false,
        message: "Project deleted successfully",
        data: {
          error: false,
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
    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while deleting the project",
        data: null,
        details: error,
      },
      { status: 500 },
    );
  }
}
