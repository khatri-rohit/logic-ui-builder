/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  GenerationPlatform as PrismaGenerationPlatform,
  Prisma,
} from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { initializeOllama } from "@/lib/ollama";

import { generateText, streamText } from "ai";
import {
  buildScreenPrompt,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
} from "@/lib/prompts";
import { ComponentTreeNode, GenerationPlatform, WebAppSpec } from "@/lib/types";
import logger from "@/lib/logger";
import { buildEnhancedPrompt } from "@/lib/promptEnhancer";
import { buildDesignContext, toDesignContextText } from "@/lib/designContext";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { generationRatelimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import {
  generationRequestBodySchema,
  toValidationIssues,
} from "@/lib/schemas/studio";
import {
  getGenerationLayout,
  getInitialDimensionsForPlatform,
} from "@/lib/canvasLayout";
import { PersistedGenerationScreen } from "@/lib/canvas-state";
import { z } from "zod";

export const runtime = "nodejs";

const STAGE1_MODELS = ["deepseek-v3.2:cloud", "gpt-oss:120b", "gemma4:31b"];
const STAGE2_MODELS = [
  "deepseek-v3.2:cloud",
  "gpt-oss:120b",
  "deepseek-v3.1:671b",
  "qwen3.5",
];
const STAGE3_MODELS = [
  "gemma4:31b",
  "deepseek-v3.1:671b",
  "qwen3.5",
  "gpt-oss:120b",
  "deepseek-v3.2:cloud",
];

const generationBodySchema = generationRequestBodySchema.superRefine(
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

const idempotencyHeaderSchema = z.string().trim().min(8).max(128);

function normalizePlatform(value: unknown): GenerationPlatform {
  return value === "mobile" ? "mobile" : "web";
}

function toPrismaPlatform(
  platform: GenerationPlatform,
): PrismaGenerationPlatform {
  return platform === "mobile" ? "MOBILE" : "WEB";
}

const MOBILE_COMPLEXITY_KEYWORDS = [
  "landing",
  "dashboard",
  "analytics",
  "pricing",
  "testimonials",
  "features",
  "faq",
  "checkout",
  "catalog",
  "profile",
  "settings",
  "feed",
  "timeline",
  "workflow",
  "step",
  "multi",
  "campaign",
  "onboarding",
  "portfolio",
  "case study",
];

function splitMobileScreensIfNeeded(
  spec: WebAppSpec,
  prompt: string,
): WebAppSpec {
  if (spec.platform !== "mobile") return spec;
  if (spec.screens.length > 1) return spec;

  const normalizedPrompt = prompt.toLowerCase();
  const keywordHits = MOBILE_COMPLEXITY_KEYWORDS.reduce(
    (count, keyword) => count + (normalizedPrompt.includes(keyword) ? 1 : 0),
    0,
  );
  const longPromptBoost = prompt.length >= 180 ? 1 : 0;
  const complexityScore = keywordHits + longPromptBoost;

  if (complexityScore < 2) return spec;

  const parts = complexityScore >= 4 ? 3 : 2;
  const baseName = spec.screens[0]?.trim() || "Mobile Screen";

  return {
    ...spec,
    screens: Array.from({ length: parts }, (_, i) => `${baseName} - ${i + 1}`),
  };
}

function coerceSpec(
  raw: Partial<WebAppSpec>,
  platform: GenerationPlatform,
): WebAppSpec {
  const screens =
    Array.isArray(raw.screens) && raw.screens.length > 0
      ? raw.screens.filter(
          (item): item is string => typeof item === "string" && !!item.trim(),
        )
      : [platform === "mobile" ? "Mobile Screen" : "Landing Page"];

  return {
    screens,
    navPattern:
      raw.navPattern === "top-nav" ||
      raw.navPattern === "sidebar" ||
      raw.navPattern === "hybrid" ||
      raw.navPattern === "none"
        ? raw.navPattern
        : "none",
    platform,
    colorMode:
      raw.colorMode === "dark" || raw.colorMode === "light"
        ? raw.colorMode
        : "light",
    primaryColor: raw.primaryColor ?? "#2563eb",
    accentColor: raw.accentColor ?? "#f59e0b",
    stylingLib:
      raw.stylingLib === "css" ||
      raw.stylingLib === "tailwind" ||
      raw.stylingLib === "shadcn"
        ? raw.stylingLib
        : "shadcn",
    layoutDensity:
      raw.layoutDensity === "compact" || raw.layoutDensity === "comfortable"
        ? raw.layoutDensity
        : "comfortable",
    components: Array.isArray(raw.components)
      ? raw.components.filter(
          (item): item is string => typeof item === "string" && !!item.trim(),
        )
      : [],
  };
}

function parseJsonStrict<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON object found in model output");
    return JSON.parse(match[0]) as T;
  }
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

async function generateTextWithFallback({
  stage,
  models,
  ollama,
  system,
  prompt,
}: {
  stage: string;
  models: string[];
  ollama: ReturnType<typeof initializeOllama>;
  system: string;
  prompt: string;
}) {
  let lastError: unknown = null;

  for (const model of models) {
    try {
      logger.info(`${stage} via model: ${model}`);
      return await generateText({
        model: ollama(model),
        system,
        prompt,
      });
    } catch (error) {
      lastError = error;
      logger.warn(`${stage} model failed: ${model}`, error);
    }
  }

  throw new Error(
    `${stage} failed across all candidate models: ${String(lastError)}`,
  );
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "generation.requested",
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

    const parsedBody = generationBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: true,
          code: "VALIDATION_ERROR",
          message: "Invalid generation payload",
          issues: toValidationIssues(parsedBody.error),
          data: null,
        },
        { status: 400 },
      );
    }

    const body = parsedBody.data;
    const preferredModel = body.model ?? null;

    const idempotencyHeaderResult = idempotencyHeaderSchema.safeParse(
      req.headers.get("Idempotency-Key"),
    );
    const idempotencyKey = idempotencyHeaderResult.success
      ? idempotencyHeaderResult.data
      : (body.idempotencyKey ?? crypto.randomUUID());

    const project = await prisma.project.findUnique({
      where: {
        id: body.projectId,
        userId: authContext.appUserId,
      },
      select: {
        id: true,
        status: true,
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

    const requestedPlatform = normalizePlatform(body.platform);
    const prompt = body.prompt.trim();

    const designContext = await buildDesignContext({
      prompt,
      platform: requestedPlatform,
    });
    const enhancedPrompt = buildEnhancedPrompt({
      prompt,
      platform: requestedPlatform,
      designContext,
    });
    const designContextText = toDesignContextText(designContext);

    const stage1ModelPriority = buildModelPriority(
      preferredModel,
      STAGE1_MODELS,
    );
    const stage2ModelPriority = buildModelPriority(
      preferredModel,
      STAGE2_MODELS,
    );
    const stage3ModelPriority = buildModelPriority(
      preferredModel,
      STAGE3_MODELS,
    );

    const ollama = initializeOllama();

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      let generationId: string | null = null;
      const persistedScreens: PersistedGenerationScreen[] = [];

      try {
        logger.info("Starting Stage 1: Spec Extraction");

        const { text: rawSpec } = await generateTextWithFallback({
          stage: "Stage 1 Spec Extraction",
          models: stage1ModelPriority,
          ollama,
          system: STAGE1_SYSTEM,
          prompt: `User prompt: ${enhancedPrompt}\nPlatform: ${requestedPlatform}\n${designContextText}`,
        });

        const rawParsedSpec = parseJsonStrict<Partial<WebAppSpec>>(rawSpec);
        const spec = splitMobileScreensIfNeeded(
          coerceSpec(rawParsedSpec, requestedPlatform),
          enhancedPrompt,
        );

        const requestedModelForPersistence =
          preferredModel ?? stage3ModelPriority[0];

        const createdGeneration = await prisma.$transaction(async (tx) => {
          const generation = await tx.generation.create({
            data: {
              projectId: project.id,
              prompt: enhancedPrompt,
              model: requestedModelForPersistence,
              platform: toPrismaPlatform(requestedPlatform),
              spec: spec as any,
              status: "RUNNING",
              idempotencyKey,
            },
            select: { id: true },
          });

          await tx.project.update({
            where: { id: project.id },
            data: { status: "GENERATING" },
          });

          return generation;
        });

        generationId = createdGeneration.id;

        await write({ type: "generation_id", generationId });
        await write({ type: "design_context", designContext });
        await write({ type: "spec", spec });

        logger.info("Stage 2: Component Planner");
        const { text: rawTree } = await generateTextWithFallback({
          stage: "Stage 2 Component Planner",
          models: stage2ModelPriority,
          ollama,
          system: STAGE2_SYSTEM,
          prompt: `${requestedPlatform}Spec: ${JSON.stringify(spec)}\n${designContextText}`,
        });
        const tree = parseJsonStrict<ComponentTreeNode[]>(rawTree);
        await write({ type: "tree", tree });

        logger.info("Stage 3: Code Synthesis");
        const screensWithDims = spec.screens.map((screenName) => ({
          name: screenName,
          ...getInitialDimensionsForPlatform(screenName, requestedPlatform),
        }));
        const positions = getGenerationLayout([], screensWithDims);

        for (const [index, screen] of spec.screens.entries()) {
          await write({ type: "screen_start", screen });

          const position = positions[index] ?? {
            x: 100 + index * 40,
            y: 100 + index * 40,
          };
          const dimensions = screensWithDims[index] ?? { w: 1200, h: 800 };
          const frameId = crypto.randomUUID();

          let screenGenerated = false;
          let streamErr: unknown = null;
          let finalCode = "";

          for (let i = 0; i < stage3ModelPriority.length; i++) {
            const candidateModel = stage3ModelPriority[i];
            try {
              if (i > 0) {
                finalCode = "";
                await write({
                  type: "screen_reset",
                  screen,
                  reason: `retry:${candidateModel}`,
                });
              }

              logger.info(
                `Stage 3 screen '${screen}' via model: ${candidateModel}`,
              );
              const result = streamText({
                model: ollama(candidateModel),
                system: STAGE3_SYSTEM,
                prompt: buildScreenPrompt(
                  spec,
                  tree,
                  screen,
                  enhancedPrompt,
                  designContext,
                ),
                temperature: 0.2,
              });

              for await (const token of result.textStream) {
                finalCode += token;
                await write({ type: "code_chunk", screen, token });
              }

              screenGenerated = true;
              break;
            } catch (err) {
              streamErr = err;
              logger.warn(
                `Stage 3 model failed for '${screen}': ${candidateModel}`,
                err,
              );
            }
          }

          if (!screenGenerated) {
            persistedScreens.push({
              id: frameId,
              state: "error",
              x: position.x,
              y: position.y,
              w: dimensions.w,
              h: dimensions.h,
              screenName: screen,
              content: finalCode,
              editedContent: null,
              error: `All stage 3 models failed: ${String(streamErr)}`,
            });

            await write({ type: "screen_done", screen });
            throw new Error(
              `All stage 3 models failed for ${screen}: ${String(streamErr)}`,
            );
          }

          persistedScreens.push({
            id: frameId,
            state: finalCode.trim() ? "done" : "error",
            x: position.x,
            y: position.y,
            w: dimensions.w,
            h: dimensions.h,
            screenName: screen,
            content: finalCode,
            editedContent: null,
            error: finalCode.trim()
              ? null
              : "Generation ended before this screen completed.",
          });

          await write({ type: "screen_done", screen });
        }

        if (generationId) {
          await prisma.$transaction([
            prisma.generation.update({
              where: { id: generationId },
              data: {
                screens: persistedScreens as unknown as Prisma.InputJsonValue,
                status: "COMPLETED",
                terminalAt: new Date(),
                errorMessage: null,
                errorMeta: Prisma.JsonNull,
              },
            }),
            prisma.project.update({
              where: { id: project.id },
              data: { status: "ACTIVE" },
            }),
          ]);
        }

        logger.info("Generation complete", {
          generationId,
          projectId: project.id,
        });
        await write({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (generationId) {
          await prisma.$transaction([
            prisma.generation.update({
              where: { id: generationId },
              data: {
                screens: persistedScreens as unknown as Prisma.InputJsonValue,
                status: "FAILED",
                terminalAt: new Date(),
                errorMessage: message,
                errorMeta: {
                  source: "api/generate",
                  stage: "stream",
                } as unknown as Prisma.InputJsonValue,
              },
            }),
            prisma.project.update({
              where: { id: project.id },
              data: { status: "ACTIVE" },
            }),
          ]);
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
