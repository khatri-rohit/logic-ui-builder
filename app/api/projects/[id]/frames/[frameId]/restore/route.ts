import {
  GenerationPlatform as PrismaGenerationPlatform,
  Prisma,
} from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { toValidationIssues, webAppSpecSchema } from "@/lib/schemas/studio";
import { GenerationPlatform } from "@/lib/types";
import { parseGenerationScreens } from "@/lib/utils";

function toApiPlatform(platform: PrismaGenerationPlatform): GenerationPlatform {
  return platform === "MOBILE" ? "mobile" : "web";
}

const paramsSchema = z.object({
  id: z.string().min(1),
  frameId: z.string().min(1),
});

const restoreBodySchema = z.object({
  versionNumber: z.number().int().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; frameId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "frame.restored",
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: true, message: "Request body must be valid JSON", data: null },
        { status: 400 },
      );
    }

    const parsedBody = restoreBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid restore payload",
          issues: toValidationIssues(parsedBody.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { versionNumber } = parsedBody.data;

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

    const frameVersion = await prisma.frameVersion.findUnique({
      where: {
        projectId_frameId_versionNumber: {
          projectId: id,
          frameId,
          versionNumber,
        },
      },
    });

    if (!frameVersion) {
      return NextResponse.json(
        { error: true, message: "Frame version not found", data: null },
        { status: 404 },
      );
    }

    const generations = await prisma.generation.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        screens: true,
        model: true,
        platform: true,
        spec: true,
        status: true,
        terminalAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let targetGeneration: (typeof generations)[number] | null = null;
    let targetScreens: ReturnType<typeof parseGenerationScreens> = [];

    for (const gen of generations) {
      const screens = parseGenerationScreens(gen.screens);
      if (screens.some((s) => s.id === frameId)) {
        targetGeneration = gen;
        targetScreens = screens;
        break;
      }
    }

    if (!targetGeneration) {
      return NextResponse.json(
        { error: true, message: "Frame not found in any generation", data: null },
        { status: 404 },
      );
    }

    const currentScreen = targetScreens.find((s) => s.id === frameId);

    if (currentScreen) {
      const maxVersion = await prisma.frameVersion.aggregate({
        where: { projectId: id, frameId },
        _max: { versionNumber: true },
      });
      const nextVersion = (maxVersion._max.versionNumber ?? 0) + 1;

      await prisma.frameVersion.create({
        data: {
          projectId: id,
          generationId: targetGeneration.id,
          frameId,
          versionNumber: nextVersion,
          content: currentScreen.content,
          editedContent: currentScreen.editedContent ?? null,
          prompt: null,
        },
      });
    }

    const updatedScreens = targetScreens.map((screen) =>
      screen.id === frameId
        ? {
            ...screen,
            content: frameVersion.content,
            editedContent: frameVersion.editedContent ?? null,
            state: "done" as const,
            error: null as string | null,
          }
        : screen,
    );

    const updatedGeneration = await prisma.generation.update({
      where: { id: targetGeneration.id },
      data: {
        screens: updatedScreens as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
        terminalAt: new Date(),
        errorMessage: null,
        errorMeta: Prisma.JsonNull,
      },
      select: {
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
      },
    });

    const parsedSpec = webAppSpecSchema.safeParse(updatedGeneration.spec);

    const generation = {
      generationId: updatedGeneration.id,
      model: updatedGeneration.model,
      platform: toApiPlatform(updatedGeneration.platform),
      spec: parsedSpec.success ? parsedSpec.data : null,
      screens: parseGenerationScreens(updatedGeneration.screens),
      status: updatedGeneration.status,
      terminalAt: updatedGeneration.terminalAt
        ? updatedGeneration.terminalAt.toISOString()
        : null,
      errorMessage: updatedGeneration.errorMessage,
      createdAt: updatedGeneration.createdAt.toISOString(),
      updatedAt: updatedGeneration.updatedAt.toISOString(),
    };

    return NextResponse.json(
      {
        error: false,
        message: `Frame restored to version ${versionNumber}`,
        data: { generation },
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
        message: "An error occurred while restoring the frame",
        data: null,
      },
      { status: 500 },
    );
  }
}
