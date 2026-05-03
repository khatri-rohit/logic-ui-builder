import {
  GenerationPlatform as PrismaGenerationPlatform,
  GenerationStatus as PrismaGenerationStatus,
  Prisma,
} from "@/app/generated/prisma/client";
import {
  ProjectDetail,
  ProjectGeneration,
  ProjectPatchResult,
  ProjectStatus,
} from "@/lib/api/types";
import {
  CanvasFrameSnapshot,
  CanvasSnapshotV1,
  CanvasStateMetadataV1,
  PersistedGenerationScreen,
  isCanvasSnapshotV1,
  isCanvasStateMetadataV1,
  toCanvasStateMetadata,
} from "@/lib/canvas-state";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { projectWriteRatelimit } from "@/lib/ratelimit";
import {
  projectRouteParamsSchema,
  persistedGenerationScreenSchema,
  projectPatchBodySchema,
  toValidationIssues,
  webAppSpecSchema,
} from "@/lib/schemas/studio";
import { GenerationPlatform } from "@/lib/types";
import { revalidateTag } from "next/cache";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";

const CANVAS_SNAPSHOT_CLOCK_SKEW_MS = 2000;
const GENERATION_NOT_FOUND = "GENERATION_NOT_FOUND";

async function enforceProjectWriteRatelimit(
  appUserId: string,
  operation: string,
) {
  try {
    const { success, limit, remaining, reset } =
      await projectWriteRatelimit.limit(appUserId);

    if (!success) {
      return NextResponse.json(
        {
          error: true,
          message: "Rate limit exceeded",
          data: null,
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

    return null;
  } catch (rateLimitError) {
    logger.error("projectWriteRatelimit.limit failed ", rateLimitError);

    return NextResponse.json(
      {
        error: true,
        message: `${operation} is temporarily unavailable. Please try again.`,
        data: null,
      },
      { status: 503 },
    );
  }
}

const generationSelect = {
  id: true,
  model: true,
  platform: true,
  spec: true,
  screens: true,
  status: true,
  terminalAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GenerationSelect;

type GenerationRecord = {
  id: string;
  model: string;
  platform: PrismaGenerationPlatform;
  spec: Prisma.JsonValue;
  screens: Prisma.JsonValue | null;
  status: PrismaGenerationStatus;
  terminalAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toApiPlatform(platform: PrismaGenerationPlatform): GenerationPlatform {
  return platform === "MOBILE" ? "mobile" : "web";
}

function normalizeCanvasMetadata(
  value: Prisma.JsonValue | null,
): CanvasStateMetadataV1 | null {
  const normalizedCandidate = value as unknown;

  if (isCanvasStateMetadataV1(normalizedCandidate)) {
    return {
      ...normalizedCandidate,
      selectedGenerationId: normalizedCandidate.selectedGenerationId ?? null,
    };
  }

  if (isCanvasSnapshotV1(normalizedCandidate)) {
    return toCanvasStateMetadata(normalizedCandidate);
  }

  return null;
}

function parseGenerationScreens(
  value: Prisma.JsonValue | null,
): PersistedGenerationScreen[] {
  const parsed = z.array(persistedGenerationScreenSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function toProjectGeneration(record: GenerationRecord): ProjectGeneration {
  const parsedSpec = webAppSpecSchema.safeParse(record.spec);

  return {
    generationId: record.id,
    model: record.model,
    platform: toApiPlatform(record.platform),
    spec: parsedSpec.success ? parsedSpec.data : null,
    screens: parseGenerationScreens(record.screens),
    status: record.status,
    terminalAt: record.terminalAt ? record.terminalAt.toISOString() : null,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toFramesFromGenerations(
  generations: ProjectGeneration[],
): CanvasFrameSnapshot[] {
  return generations.flatMap((generation) =>
    generation.screens.map((screen) => ({
      ...screen,
      generationId: generation.generationId,
      platform: generation.platform,
    })),
  );
}

function stripGenerationFrames(
  frames: CanvasFrameSnapshot[],
  generationId: string,
): PersistedGenerationScreen[] {
  return frames
    .filter((frame) => frame.generationId === generationId)
    .map((frame) => ({
      id: frame.id,
      state: frame.state,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
      screenName: frame.screenName,
      content: frame.content,
      editedContent: frame.editedContent,
      error: frame.error,
    }));
}

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
        title: true,
        description: true,
        initialPrompt: true,
        status: true,
        platform: true,
        canvasState: true,
        generations: {
          orderBy: { createdAt: "asc" },
          select: generationSelect,
        },
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

    const generations = project.generations.map((generation) =>
      toProjectGeneration(generation as GenerationRecord),
    );
    const normalizedCanvasState = normalizeCanvasMetadata(project.canvasState);

    const data: ProjectDetail = {
      id: project.id,
      title: project.title ?? "Untitled Project",
      description: project.description ?? null,
      status: project.status as ProjectStatus,
      initialPrompt: project.initialPrompt,
      platform:
        project.platform === PrismaGenerationPlatform.MOBILE ? "mobile" : "web",
      canvasState: normalizedCanvasState,
      frames: toFramesFromGenerations(generations),
      generations,
    };

    return NextResponse.json(
      {
        error: false,
        message: "Project fetched successfully",
        data,
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
      },
      { status: 500 },
    );
  }
}

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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
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

    const parsedBody = projectPatchBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid project patch payload",
          issues: toValidationIssues(parsedBody.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { title, description, status, canvasState, generationId } =
      parsedBody.data;

    const project = await prisma.project.findUnique({
      where: { id, userId: authContext.appUserId },
      select: {
        id: true,
        title: true,
        description: true,
        initialPrompt: true,
        status: true,
        canvasState: true,
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

    const persistedCanvasState = normalizeCanvasMetadata(project.canvasState);

    if (canvasState) {
      const incomingSavedAtMs = new Date(canvasState.savedAt).getTime();

      if (persistedCanvasState) {
        const persistedSavedAtMs = Date.parse(persistedCanvasState.savedAt);
        if (
          !Number.isNaN(persistedSavedAtMs) &&
          incomingSavedAtMs + CANVAS_SNAPSHOT_CLOCK_SKEW_MS <=
            persistedSavedAtMs
        ) {
          return NextResponse.json(
            {
              error: true,
              message: "Stale canvasState payload rejected",
              code: "CANVAS_STATE_CONFLICT",
              data: null,
            },
            { status: 409 },
          );
        }
      }
    }

    let canvasStateForProject: CanvasStateMetadataV1 | null | undefined;
    if (canvasState !== undefined) {
      canvasStateForProject = canvasState
        ? toCanvasStateMetadata({
            ...canvasState,
            selectedGenerationId: canvasState.selectedGenerationId ?? null,
          } as CanvasSnapshotV1)
        : null;

      if (
        canvasStateForProject &&
        generationId &&
        !canvasStateForProject.selectedGenerationId
      ) {
        canvasStateForProject = {
          ...canvasStateForProject,
          selectedGenerationId: generationId,
        };
      }
    }

    const generationScreensPayload =
      generationId && canvasState
        ? stripGenerationFrames(canvasState.frames, generationId)
        : undefined;

    const { updatedProject, updatedGeneration } = await prisma.$transaction(
      async (tx) => {
        let updatedGenerationRecord: GenerationRecord | null = null;

        if (generationId) {
          const existingGeneration = await tx.generation.findFirst({
            where: {
              id: generationId,
              projectId: project.id,
            },
            select: generationSelect,
          });

          if (!existingGeneration) {
            throw new Error(GENERATION_NOT_FOUND);
          }

          if (generationScreensPayload !== undefined) {
            updatedGenerationRecord = (await tx.generation.update({
              where: { id: generationId },
              data: {
                screens:
                  generationScreensPayload as unknown as Prisma.InputJsonValue,
              },
              select: generationSelect,
            })) as GenerationRecord;
          } else {
            updatedGenerationRecord = existingGeneration as GenerationRecord;
          }
        }

        const updateData: Prisma.ProjectUpdateInput = {};

        if (status !== undefined) {
          updateData.status = status;
        }

        if (title !== undefined) {
          updateData.title = title;
        }

        if (description !== undefined) {
          updateData.description = description;
        }

        if (canvasStateForProject !== undefined) {
          updateData.canvasState =
            canvasStateForProject === null
              ? Prisma.JsonNull
              : (canvasStateForProject as unknown as Prisma.InputJsonValue);
        }

        const projectRecord = await tx.project.update({
          where: { id: project.id },
          data: updateData,
          select: {
            id: true,
            title: true,
            description: true,
            initialPrompt: true,
            status: true,
            platform: true,
            canvasState: true,
          },
        });

        return {
          updatedProject: projectRecord,
          updatedGeneration: updatedGenerationRecord,
        };
      },
    );

    const responseData: ProjectPatchResult = {
      project: {
        id: updatedProject.id,
        title: updatedProject.title ?? "Untitled Project",
        description: updatedProject.description ?? null,
        initialPrompt: updatedProject.initialPrompt,
        status: updatedProject.status as ProjectStatus,
        platform:
          updatedProject.platform === PrismaGenerationPlatform.MOBILE
            ? "mobile"
            : "web",
        canvasState: normalizeCanvasMetadata(updatedProject.canvasState),
      },
      generation: updatedGeneration
        ? toProjectGeneration(updatedGeneration)
        : null,
    };

    return NextResponse.json(
      {
        error: false,
        message: "Project updated successfully",
        data: responseData,
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

    if (error instanceof Error && error.message === GENERATION_NOT_FOUND) {
      return NextResponse.json(
        {
          error: true,
          message: "Generation not found for this project",
          data: null,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while updating the project",
        data: null,
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

    const rateLimitResponse = await enforceProjectWriteRatelimit(
      authContext.appUserId,
      "Project deletion",
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
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

    const deletionResult = await prisma.project.deleteMany({
      where: {
        id,
        userId: authContext.appUserId,
      },
    });

    if (deletionResult.count === 0) {
      return NextResponse.json(
        {
          error: true,
          message: "Project not found",
          data: null,
        },
        { status: 404 },
      );
    }
    revalidateTag("projects:list", { expire: 0 });

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
      },
      { status: 500 },
    );
  }
}
