import { NextRequest, NextResponse } from "next/server";
import {
  GenerationPlatform as PrismaGenerationPlatform,
  GenerationStatus as PrismaGenerationStatus,
  Prisma,
} from "@/app/generated/prisma/client";
import {
  ProjectDetail,
  ProjectGeneration,
  ProjectStatus,
} from "@/lib/api/types";
import {
  CanvasFrameSnapshot,
  CanvasStateMetadataV1,
  PersistedGenerationScreen,
  isCanvasSnapshotV1,
  isCanvasStateMetadataV1,
  toCanvasStateMetadata,
} from "@/lib/canvas-state";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { persistedGenerationScreenSchema, webAppSpecSchema } from "@/lib/schemas/studio";
import { GenerationPlatform } from "@/lib/types";
import { z } from "zod";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token || token.length < 16) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid share token",
          data: null,
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: {
        shareToken: token,
        isPublic: true,
      },
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
          message: "Project not found or not publicly shared",
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
      isPublic: true,
      shareToken: null,
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
    logger.error("Error fetching shared project:", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: true,
        message: "An error occurred while fetching the shared project",
        data: null,
      },
      { status: 500 },
    );
  }
}
