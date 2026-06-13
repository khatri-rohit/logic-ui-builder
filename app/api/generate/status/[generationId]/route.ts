import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import prisma from "@/lib/prisma";
import { parseGenerationScreens } from "@/lib/utils";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  generationId: z.string().cuid(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ generationId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "generation.status.requested",
    });

    if (!authContext.appUserId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: true, message: "Invalid generation ID" },
        { status: 400 },
      );
    }

    const { generationId } = parsedParams.data;

    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        project: { userId: authContext.appUserId },
      },
      select: {
        id: true,
        status: true,
        spec: true,
        tree: true,
        screens: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!generation) {
      return NextResponse.json(
        { error: true, message: "Generation not found" },
        { status: 404 },
      );
    }

    const screens = parseGenerationScreens(generation.screens);

    // Derive pending screens from spec
    let specScreens: string[] = [];
    try {
      const spec = generation.spec as Record<string, unknown> | null;
      if (spec && Array.isArray(spec.screens)) {
        specScreens = spec.screens.filter((s): s is string => typeof s === "string");
      }
    } catch {
      specScreens = [];
    }

    const terminalScreenNames = new Set(
      screens
        .filter((s) => s.state === "done" || s.state === "error")
        .map((s) => s.screenName),
    );
    const pendingScreens = specScreens.filter(
      (s) => !terminalScreenNames.has(s),
    );

    return NextResponse.json({
      error: false,
      data: {
        generationId: generation.id,
        status: generation.status,
        spec: generation.spec,
        tree: generation.tree,
        screens,
        pendingScreens,
        errorMessage: generation.errorMessage,
        updatedAt: generation.updatedAt,
      },
    });
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

    const err = error as Error;
    return NextResponse.json(
      { error: true, message: err.message },
      { status: 500 },
    );
  }
}
