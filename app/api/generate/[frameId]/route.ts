/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  GenerationPlatform as PrismaGenerationPlatform,
  Prisma,
} from "@/app/generated/prisma/client";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { PersistedGenerationScreen } from "@/lib/canvas-state";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import logger from "@/lib/logger";
import { initializeOllama } from "@/lib/ollama";
import prisma from "@/lib/prisma";
import { buildScreenPrompt, STAGE3_SYSTEM } from "@/lib/prompts";
import { generationRatelimit } from "@/lib/ratelimit";
import {
  frameRegenerateRequestBodySchema,
  persistedGenerationScreenSchema,
  toValidationIssues,
  webAppSpecSchema,
} from "@/lib/schemas/studio";
import { ComponentTreeNode, GenerationPlatform, WebAppSpec } from "@/lib/types";

export const runtime = "nodejs";

const STAGE3_MODELS = [
  "gemma4:31b",
  "deepseek-v3.1:671b",
  "qwen3.5",
  "gpt-oss:120b",
  "deepseek-v3.2:cloud",
];

const frameRouteParamsSchema = z.object({
  frameId: z.union([z.string().cuid(), z.string().uuid()]),
});

const idempotencyHeaderSchema = z.string().trim().min(8).max(128);

const frameRegenerateBodySchema = frameRegenerateRequestBodySchema.superRefine(
  (value, ctx) => {
    if (value.model && !STAGE3_MODELS.includes(value.model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["model"],
        message: "Unsupported model selection",
      });
    }
  },
);

function toApiPlatform(platform: PrismaGenerationPlatform): GenerationPlatform {
  return platform === "MOBILE" ? "mobile" : "web";
}

function toPrismaPlatform(
  platform: GenerationPlatform,
): PrismaGenerationPlatform {
  return platform === "mobile" ? "MOBILE" : "WEB";
}

function buildModelPriority(
  preferredModel: string | null,
  defaults: readonly string[],
) {
  if (!preferredModel) {
    return [...defaults];
  }

  if (defaults.includes(preferredModel)) {
    return [
      preferredModel,
      ...defaults.filter((model) => model !== preferredModel),
    ];
  }

  return [preferredModel, ...defaults];
}

function parseGenerationScreens(
  value: Prisma.JsonValue | null,
): PersistedGenerationScreen[] {
  const parsed = z.array(persistedGenerationScreenSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function coerceSpec(
  rawSpec: Prisma.JsonValue,
  platform: GenerationPlatform,
  screenName: string,
): WebAppSpec {
  const parsedSpec = webAppSpecSchema.safeParse(rawSpec);
  if (parsedSpec.success) {
    if (parsedSpec.data.screens.includes(screenName)) {
      return parsedSpec.data;
    }

    return {
      ...parsedSpec.data,
      screens: [...parsedSpec.data.screens, screenName],
    };
  }

  return {
    screens: [screenName],
    navPattern: "none",
    platform,
    colorMode: "light",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
    stylingLib: "tailwind",
    layoutDensity: "comfortable",
    components: [],
  };
}

function buildFrameRegeneratePrompt({
  basePrompt,
  prompt,
  screenName,
}: {
  basePrompt: string;
  prompt?: string;
  screenName: string;
}) {
  const normalizedPrompt = prompt?.trim();
  if (!normalizedPrompt) {
    return basePrompt;
  }

  return [
    basePrompt,
    "",
    "FRAME MODIFICATION REQUEST:",
    `- Target screen: ${screenName}`,
    "- Apply changes only to this screen while preserving the established design language.",
    normalizedPrompt,
  ].join("\n");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ frameId: string }> },
) {
  const parsedParams = frameRouteParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: true,
        code: "VALIDATION_ERROR",
        message: "Invalid frame route parameters",
        issues: toValidationIssues(parsedParams.error),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: true,
      message: "Frame-based generation endpoint is not implemented",
      data: {
        frameId: parsedParams.data.frameId,
      },
    },
    { status: 501 },
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ frameId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "frame.generation.requested",
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

    const parsedParams = frameRouteParamsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid frame route parameters",
          issues: toValidationIssues(parsedParams.error),
          data: null,
        },
        { status: 400 },
      );
    }

    try {
      const { success, limit, remaining, reset } =
        await generationRatelimit.limit(authContext.appUserId);

      if (!success) {
        return NextResponse.json(
          { error: true, message: "Rate limit exceeded" },
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
    } catch (rateLimitError) {
      logger.error(
        `generationRatelimit.limit failed for authContext.appUserId=${authContext.appUserId}`,
        rateLimitError,
      );

      return NextResponse.json(
        {
          error: true,
          message: "Generation is temporarily unavailable. Please try again.",
        },
        { status: 503 },
      );
    }

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

    const parsedBody = frameRegenerateBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid frame regenerate payload",
          issues: toValidationIssues(parsedBody.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const { frameId } = parsedParams.data;
    const body = parsedBody.data;
    const promptOverride = body.prompt?.trim();
    const hasPromptOverride = Boolean(promptOverride);

    const project = await prisma.project.findUnique({
      where: {
        id: body.projectId,
        userId: authContext.appUserId,
      },
      select: {
        id: true,
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

    const generationCandidates = await prisma.generation.findMany({
      where: body.generationId
        ? {
            projectId: project.id,
            id: body.generationId,
          }
        : {
            projectId: project.id,
          },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        model: true,
        platform: true,
        spec: true,
        prompt: true,
        screens: true,
        tree: true,
      },
    });

    let sourceGeneration: (typeof generationCandidates)[number] | null = null;
    let sourceScreens: PersistedGenerationScreen[] = [];
    let sourceFrame: PersistedGenerationScreen | null = null;

    for (const candidate of generationCandidates) {
      const candidateScreens = parseGenerationScreens(candidate.screens);
      const matchedFrame = candidateScreens.find(
        (screen) => screen.id === frameId,
      );
      if (!matchedFrame) continue;

      sourceGeneration = candidate;
      sourceScreens = candidateScreens;
      sourceFrame = matchedFrame;
      break;
    }

    if (!sourceGeneration || !sourceFrame) {
      return NextResponse.json(
        {
          error: true,
          message: body.generationId
            ? "Frame not found in the requested generation"
            : "Frame not found in this project",
          data: null,
        },
        { status: 404 },
      );
    }

    const idempotencyHeaderResult = idempotencyHeaderSchema.safeParse(
      req.headers.get("Idempotency-Key"),
    );
    const requestIdempotencyKey = idempotencyHeaderResult.success
      ? idempotencyHeaderResult.data
      : body.idempotencyKey;

    const idempotencyKey = hasPromptOverride
      ? `${authContext.appUserId}:${requestIdempotencyKey ?? crypto.randomUUID()}`
      : null;

    if (idempotencyKey) {
      const duplicateGeneration = await prisma.generation.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          projectId: true,
          status: true,
        },
      });

      if (duplicateGeneration) {
        return NextResponse.json(
          {
            error: true,
            code: "DUPLICATE_GENERATION_REQUEST",
            message: "Duplicate generation request rejected by idempotency key",
            data: {
              generationId: duplicateGeneration.id,
              status: duplicateGeneration.status,
            },
          },
          { status: 409 },
        );
      }
    }

    const sourcePlatform = toApiPlatform(sourceGeneration.platform);
    const spec = coerceSpec(
      sourceGeneration.spec,
      sourcePlatform,
      sourceFrame.screenName,
    );

    const storedTree = (() => {
      if (!sourceGeneration.tree) return null;
      try {
        const parsed = z
          .array(
            z.object({
              screen: z.string(),
              components: z.array(z.string()),
              canvasX: z.number(),
              canvasY: z.number(),
              layoutArchitecture: z.record(z.string(), z.unknown()).optional(),
              componentIntents: z.array(z.unknown()).optional(),
            }),
          )
          .safeParse(sourceGeneration.tree);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    })();

    const tree: ComponentTreeNode[] = storedTree
      ? (storedTree as ComponentTreeNode[])
      : [
          {
            screen: sourceFrame.screenName,
            components: spec.components,
            canvasX: sourceFrame.x,
            canvasY: sourceFrame.y,
          },
        ];

    const regeneratePrompt = buildFrameRegeneratePrompt({
      basePrompt: sourceGeneration.prompt,
      prompt: promptOverride,
      screenName: sourceFrame.screenName,
    });

    const sourceModel = STAGE3_MODELS.includes(sourceGeneration.model)
      ? sourceGeneration.model
      : null;
    const preferredModel = body.model ?? sourceModel;
    const stage3ModelPriority = buildModelPriority(
      preferredModel,
      STAGE3_MODELS,
    );
    const persistenceModel = body.model ?? sourceGeneration.model;

    const ollama = initializeOllama();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      let generationId = sourceGeneration.id;
      let createdPromptGeneration = false;
      let generatedCode = "";

      try {
        if (hasPromptOverride) {
          const createdGeneration = await prisma.generation.create({
            data: {
              projectId: project.id,
              prompt: regeneratePrompt,
              model: persistenceModel,
              platform: toPrismaPlatform(sourcePlatform),
              spec: spec as any,
              status: "RUNNING",
              idempotencyKey,
            },
            select: {
              id: true,
            },
          });

          generationId = createdGeneration.id;
          createdPromptGeneration = true;
        }

        await write({ type: "generation_id", generationId });
        await write({
          type: "frame_start",
          frameId: sourceFrame.id,
          screen: sourceFrame.screenName,
        });

        let generated = false;
        let streamError: unknown = null;

        for (let i = 0; i < stage3ModelPriority.length; i++) {
          const candidateModel = stage3ModelPriority[i];

          try {
            if (i > 0) {
              generatedCode = "";
              await write({
                type: "frame_reset",
                frameId: sourceFrame.id,
                screen: sourceFrame.screenName,
                reason: `retry:${candidateModel}`,
              });
            }

            logger.info(
              `Frame regenerate '${sourceFrame.screenName}' via model: ${candidateModel}`,
            );

            const result = streamText({
              model: ollama(candidateModel),
              system: STAGE3_SYSTEM,
              prompt: buildScreenPrompt(
                spec,
                tree,
                sourceFrame.screenName,
                regeneratePrompt,
              ),
              temperature: 0.2,
            });

            for await (const token of result.textStream) {
              generatedCode += token;
              await write({
                type: "code_chunk",
                frameId: sourceFrame.id,
                token,
              });
            }

            generated = true;
            break;
          } catch (error) {
            streamError = error;
            logger.warn(
              `Frame regenerate model failed '${sourceFrame.screenName}': ${candidateModel}`,
              error,
            );
          }
        }

        if (!generated) {
          throw new Error(
            `All stage 3 models failed for frame ${sourceFrame.id}: ${String(streamError)}`,
          );
        }

        if (!generatedCode.trim()) {
          throw new Error("Generation ended before this frame completed.");
        }

        const updatedFrame: PersistedGenerationScreen = {
          ...sourceFrame,
          state: "done",
          content: generatedCode,
          editedContent: null,
          error: null,
        };

        if (createdPromptGeneration) {
          await prisma.generation.update({
            where: { id: generationId },
            data: {
              screens: [updatedFrame] as unknown as Prisma.InputJsonValue,
              status: "COMPLETED",
              terminalAt: new Date(),
              errorMessage: null,
              errorMeta: Prisma.JsonNull,
            },
          });
        } else {
          const nextScreens = sourceScreens.map((screen) =>
            screen.id === sourceFrame.id ? updatedFrame : screen,
          );

          await prisma.generation.update({
            where: { id: generationId },
            data: {
              screens: nextScreens as unknown as Prisma.InputJsonValue,
              status: "COMPLETED",
              terminalAt: new Date(),
              errorMessage: null,
              errorMeta: Prisma.JsonNull,
            },
          });
        }

        await write({
          type: "frame_done",
          frameId: sourceFrame.id,
          screen: sourceFrame.screenName,
        });
        await write({ type: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (createdPromptGeneration) {
          const failedFrame: PersistedGenerationScreen = {
            ...sourceFrame,
            state: "error",
            content: generatedCode.trim() ? generatedCode : sourceFrame.content,
            editedContent: null,
            error: message,
          };

          await prisma.generation.update({
            where: { id: generationId },
            data: {
              screens: [failedFrame] as unknown as Prisma.InputJsonValue,
              status: "FAILED",
              terminalAt: new Date(),
              errorMessage: message,
              errorMeta: {
                source: "api/generate/[frameId]",
                stage: "stage3",
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }

        await write({ type: "error", message });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
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
    logger.error(err);
    return NextResponse.json(
      {
        error: true,
        message: err.message,
      },
      { status: 500 },
    );
  }
}
