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
  GENERATED_SCREEN_LIMITS,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  validateGeneratedTSX,
} from "@/lib/prompts";
import { ComponentTreeNode, GenerationPlatform, WebAppSpec } from "@/lib/types";
import logger from "@/lib/logger";
import {
  buildEnhancedPrompt,
  buildFrameRegeneratePrompt,
} from "@/lib/promptEnhancer";
import { buildDesignContext, toDesignContextText } from "@/lib/designContext";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getGenerationBurstLimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import {
  generationRequestBodySchema,
  toValidationIssues,
  webAppSpecSchema,
} from "@/lib/schemas/studio";
import {
  getGenerationLayout,
  getInitialDimensionsForPlatform,
} from "@/lib/canvasLayout";
import { PersistedGenerationScreen } from "@/lib/canvas-state";
import { parseGenerationScreens } from "@/lib/utils";
import { z } from "zod";
import { guardGenerationRequest } from "@/lib/plan-guard";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";

export const runtime = "nodejs";

const STAGE1_MODELS = [
  "qwen3-coder-next:cloud",
  "mistral-large-3:675b-cloud",
  "gemma4:31b",
];
const STAGE2_MODELS = [
  "qwen3-coder-next:cloud",
  "glm-5:cloud",
  "mistral-large-3:675b-cloud",
];
const STAGE3_MODELS = [
  "kimi-k2.6:cloud",
  "qwen3-coder:480b-cloud",
  "gemma4:31b",
  "gpt-oss:120b-cloud",
  "mistral-large-3:675b-cloud",
];

const generationBodySchema = generationRequestBodySchema;

const idempotencyHeaderSchema = z.string().trim().min(8).max(128);

function normalizePlatform(value: unknown): GenerationPlatform {
  return value === "mobile" ? "mobile" : "web";
}

function toPrismaPlatform(
  platform: GenerationPlatform,
): PrismaGenerationPlatform {
  return platform === "mobile" ? "MOBILE" : "WEB";
}

function toApiPlatform(platform: PrismaGenerationPlatform): GenerationPlatform {
  return platform === "MOBILE" ? "mobile" : "web";
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

  const parts = Math.min(
    complexityScore >= 5 || prompt.length >= 360 ? 3 : 2,
    GENERATED_SCREEN_LIMITS.mobile,
  );
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
  const maxScreens = GENERATED_SCREEN_LIMITS[platform];

  return {
    screens: screens.slice(0, maxScreens),
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
    stylingLib: raw.stylingLib === "css" ? "css" : "tailwind",
    layoutDensity:
      raw.layoutDensity === "compact" || raw.layoutDensity === "comfortable"
        ? raw.layoutDensity
        : "comfortable",
    components: Array.isArray(raw.components)
      ? raw.components.filter(
          (item): item is string => typeof item === "string" && !!item.trim(),
        )
      : [],
    // Design DNA — pass through whatever Stage 1 extracted, validated lightly
    ...(raw.visualPersonality && {
      visualPersonality: raw.visualPersonality,
    }),
    ...(raw.dominantLayoutPattern && {
      dominantLayoutPattern: raw.dominantLayoutPattern,
    }),
    ...(raw.typographyAuthority && {
      typographyAuthority: raw.typographyAuthority,
    }),
    ...(raw.spacingPhilosophy && {
      spacingPhilosophy: raw.spacingPhilosophy,
    }),
    ...(raw.primaryInteraction && {
      primaryInteraction: raw.primaryInteraction,
    }),
    ...(typeof raw.keyEmotionalTone === "string" &&
      raw.keyEmotionalTone && {
        keyEmotionalTone: raw.keyEmotionalTone,
      }),
    ...(typeof raw.contentDensityScore === "number" &&
      raw.contentDensityScore >= 1 &&
      raw.contentDensityScore <= 5 && {
        contentDensityScore: raw.contentDensityScore,
      }),
  };
}

function parseJsonStrict<T>(raw: string): T {
  // Strip markdown code fences first
  const stripped = raw
    .replace(/^```(?:json|javascript|typescript)?\n?/gm, "")
    .replace(/^```$/gm, "")
    .trim();

  // Try direct parse
  try {
    return JSON.parse(stripped) as T;
  } catch {
    /* continue */
  }

  // Extract the FIRST complete JSON object using a brace-counter approach
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = stripped.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch {
          start = -1;
        } // not valid JSON, keep scanning
      }
    }
  }

  throw new Error("No valid JSON object found in model output");
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
      const burstLimiter = getGenerationBurstLimit(authContext.effectivePlanId);
      const { success, limit, remaining, reset } = await burstLimiter.limit(
        authContext.appUserId,
      );
      logger.info("Burst rate limit check for generation request", {
        userId: authContext.appUserId,
        planId: authContext.effectivePlanId,
        success,
        limit,
        remaining,
        reset,
      });
      if (!success) {
        return NextResponse.json(
          { error: true, message: "Too many requests in a short period." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
            },
          },
        );
      }
    } catch (rateLimitError) {
      logger.error(
        `getGenerationBurstLimit(${authContext.effectivePlanId}).limit failed for authContext.appUserId=${authContext.appUserId}`,
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

    // Create an AbortController tied to the request lifecycle
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => abortController.abort());

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
    const requestIdempotencyKey = idempotencyHeaderResult.success
      ? idempotencyHeaderResult.data
      : (body.idempotencyKey ?? crypto.randomUUID());
    const idempotencyKey = `${authContext.appUserId}:${requestIdempotencyKey}`;

    const project = await prisma.project.findUnique({
      where: {
        id: body.projectId,
        userId: authContext.appUserId,
      },
      select: {
        id: true,
        status: true,
        platform: true,
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

    const guardResult = await guardGenerationRequest(authContext);
    if (!guardResult.allowed) return guardResult.response;
    const { usage } = guardResult;
    logger.info("Plan guard passed for generation request", { usage });

    const isFrameRegeneration = !!body.frameId && !!body.generationId;
    const targetFrameId = isFrameRegeneration
      ? (body.targetFrameId ?? body.frameId)
      : null;

    let sourceGeneration: {
      id: string;
      prompt: string;
      model: string;
      platform: PrismaGenerationPlatform;
      spec: Prisma.JsonValue;
      tree: Prisma.JsonValue | null;
      screens: Prisma.JsonValue;
    } | null = null;

    let sourceFrame: PersistedGenerationScreen | null = null;

    if (isFrameRegeneration) {
      const generationCandidates = await prisma.generation.findMany({
        where: {
          projectId: project.id,
          id: body.generationId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          prompt: true,
          model: true,
          platform: true,
          spec: true,
          tree: true,
          screens: true,
        },
      });

      for (const candidate of generationCandidates) {
        const candidateScreens = parseGenerationScreens(candidate.screens);
        const matchedFrame = candidateScreens.find(
          (screen) => screen.id === body.frameId,
        );
        if (!matchedFrame) continue;

        sourceGeneration = candidate;
        sourceFrame = matchedFrame;
        break;
      }

      if (!sourceGeneration || !sourceFrame) {
        return NextResponse.json(
          {
            error: true,
            message: "Frame not found in the requested generation",
            data: null,
          },
          { status: 404 },
        );
      }

      logger.info("Frame regeneration detected", {
        frameId: body.frameId,
        targetFrameId,
        generationId: body.generationId,
        screenName: sourceFrame.screenName,
      });
    }

    const requestedPlatform =
      isFrameRegeneration && sourceGeneration
        ? toApiPlatform(sourceGeneration.platform)
        : toApiPlatform(project.platform);
    const prompt = body.prompt.trim();

    let designContext: Awaited<ReturnType<typeof buildDesignContext>>;
    let stage3Prompt: string;
    let designContextText: string;

    if (isFrameRegeneration && sourceGeneration) {
      designContext = await buildDesignContext({
        prompt: sourceGeneration.prompt,
        platform: toApiPlatform(sourceGeneration.platform),
      });
      stage3Prompt = buildFrameRegeneratePrompt({
        basePrompt: sourceGeneration.prompt,
        prompt: prompt,
        screenName: sourceFrame!.screenName,
      });
      designContextText = toDesignContextText(designContext);
    } else {
      designContext = await buildDesignContext({
        prompt,
        platform: requestedPlatform,
      });
      stage3Prompt = buildEnhancedPrompt({
        prompt,
        platform: requestedPlatform,
        designContext,
      });
      designContextText = toDesignContextText(designContext);
    }

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
        // If frame regeneration, create generation with existing spec/tree and skip to Stage 3
        if (isFrameRegeneration && sourceGeneration && sourceFrame) {
          const requestedModelForPersistence =
            preferredModel ?? sourceGeneration.model;

          const createdGeneration = await prisma.$transaction(async (tx) => {
            const generation = await tx.generation.create({
              data: {
                projectId: project.id,
                prompt: prompt || sourceGeneration.prompt,
                model: requestedModelForPersistence,
                platform: sourceGeneration.platform,
                spec: sourceGeneration.spec as any,
                tree: sourceGeneration.tree as
                  | Prisma.InputJsonValue
                  | undefined,
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

          logger.info("Frame regeneration: skipping Stage 1 & 2", {
            generationId,
            frameId: body.frameId,
            screenName: sourceFrame!.screenName,
          });

          await write({ type: "generation_id", generationId });

          const sourcePlatform = toApiPlatform(sourceGeneration.platform);

          const storedTree = (() => {
            if (!sourceGeneration.tree) return null;
            try {
              const parsed = z
                .array(
                  z.object({
                    screen: z.string(),
                    components: z.array(z.string()),
                    canvasX: z.number().optional(),
                    canvasY: z.number().optional(),
                    layoutArchitecture: z
                      .record(z.string(), z.unknown())
                      .optional(),
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
                  components: [],
                  canvasX: sourceFrame.x,
                  canvasY: sourceFrame.y,
                },
              ];

          const webAppSpecParsed = webAppSpecSchema.safeParse(
            sourceGeneration.spec,
          );
          const spec: WebAppSpec = webAppSpecParsed.success
            ? webAppSpecParsed.data
            : {
                screens: [sourceFrame.screenName],
                navPattern: "none",
                platform: sourcePlatform,
                colorMode: "light",
                primaryColor: "#2563eb",
                accentColor: "#f59e0b",
                stylingLib: "tailwind",
                layoutDensity: "comfortable",
                components: [],
              };

          await write({ type: "screen_start", screen: sourceFrame.screenName });

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
                  screen: sourceFrame.screenName,
                  reason: `retry:${candidateModel}`,
                });
              }

              logger.info(
                `Frame regeneration Stage 3 '${sourceFrame.screenName}' via model: ${candidateModel}`,
              );
              const { usage: stage3Usage, textStream } = streamText({
                model: ollama(candidateModel),
                system: STAGE3_SYSTEM,
                prompt: buildScreenPrompt(
                  spec,
                  tree,
                  sourceFrame.screenName,
                  stage3Prompt,
                  designContext,
                ),
                temperature: 0.2,
                abortSignal: abortController.signal,
              });

              for await (const token of textStream) {
                if (abortController.signal.aborted) break;
                finalCode += token;
                await write({
                  type: "code_chunk",
                  screen: sourceFrame.screenName,
                  token,
                });
              }
              logger.info("Frame regeneration response stream complete", {
                usage: stage3Usage,
              });
              screenGenerated = true;
              break;
            } catch (err) {
              streamErr = err;
              logger.warn(
                `Frame regeneration model failed '${sourceFrame.screenName}': ${candidateModel}`,
                err,
              );
              if ((err as Error)?.name === "AbortError") {
                logger.info(
                  "Frame regeneration aborted due to client disconnect",
                );
                return;
              }
            }
          }

          if (!screenGenerated) {
            persistedScreens.push({
              id: targetFrameId ?? body.frameId!,
              state: "error",
              x: sourceFrame!.x,
              y: sourceFrame!.y,
              w: sourceFrame!.w,
              h: sourceFrame!.h,
              screenName: sourceFrame!.screenName,
              content: sanitizeGeneratedCode(finalCode),
              editedContent: null,
              error: `All stage 3 models failed: ${String(streamErr)}`,
            });

            throw new Error(
              `All stage 3 models failed for frame ${body.frameId}: ${String(streamErr)}`,
            );
          }

          // Validate TSX for frame regeneration but remain lenient
          const frameSyntaxValidation = validateGeneratedTSX(finalCode);
          if (!frameSyntaxValidation.valid) {
            logger.warn(
              `Frame regeneration TSX issues for '${sourceFrame!.screenName}': ${frameSyntaxValidation.issues.join("; ")}`,
            );
            await write({
              type: "quality_warning",
              screen: sourceFrame!.screenName,
              issues: frameSyntaxValidation.issues,
              score: 0,
            });
          }

          persistedScreens.push({
            id: targetFrameId ?? body.frameId!,
            state: finalCode.trim() ? "done" : "error",
            x: sourceFrame!.x,
            y: sourceFrame!.y,
            w: sourceFrame!.w,
            h: sourceFrame!.h,
            screenName: sourceFrame!.screenName,
            content: sanitizeGeneratedCode(finalCode),
            editedContent: null,
            error: finalCode.trim()
              ? frameSyntaxValidation.valid
                ? null
                : `TSX issues: ${frameSyntaxValidation.issues.join("; ")}`
              : "Generation ended before this screen completed.",
          });

          await write({ type: "screen_done", screen: sourceFrame.screenName });

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

          logger.info("Frame regeneration complete", {
            generationId,
            frameId: body.frameId,
            screenName: sourceFrame.screenName,
          });
          await write({ type: "done" });
          return;
        }

        // Normal full generation flow - Stage 1, 2, 3
        logger.info("Starting Stage 1: Spec Extraction");

        const { text: rawSpec, usage: stage1Usage } =
          await generateTextWithFallback({
            stage: "Stage 1 Spec Extraction",
            models: stage1ModelPriority,
            ollama,
            system: STAGE1_SYSTEM,
            prompt: `User prompt: ${prompt}\nPlatform: ${requestedPlatform}\n${designContextText}`,
          });

        const rawParsedSpec = parseJsonStrict<Partial<WebAppSpec>>(rawSpec);
        const spec = splitMobileScreensIfNeeded(
          coerceSpec(rawParsedSpec, requestedPlatform),
          prompt,
        );
        logger.info("Stage 1 Spec Extraction complete", { usage: stage1Usage });
        const requestedModelForPersistence =
          preferredModel ?? stage3ModelPriority[0];

        const createdGeneration = await prisma.$transaction(async (tx) => {
          const generation = await tx.generation.create({
            data: {
              projectId: project.id,
              prompt,
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

        logger.info("Generation usage slot reserved", {
          usagePeriodId: usage.usagePeriodId,
        });

        await write({ type: "generation_id", generationId });
        await write({ type: "design_context", designContext });
        await write({ type: "spec", spec });

        logger.info("Stage 2: Component Planner");
        const { text: rawTree, usage: treeUsage } =
          await generateTextWithFallback({
            stage: "Stage 2 Component Planner",
            models: stage2ModelPriority,
            ollama,
            system: STAGE2_SYSTEM,
            prompt: `${requestedPlatform}Spec: ${JSON.stringify(spec)}\n${designContextText}`,
          });
        const tree = parseJsonStrict<ComponentTreeNode[]>(rawTree);
        await write({ type: "tree", tree });
        logger.info("Stage 2 Component Planner complete", { usage: treeUsage });
        if (generationId) {
          await prisma.generation.update({
            where: { id: generationId },
            data: { tree: tree as unknown as Prisma.InputJsonValue },
          });
        }

        logger.info("Stage 3: Code Synthesis");
        const screensWithDims = spec.screens.map((screenName) => ({
          name: screenName,
          ...getInitialDimensionsForPlatform(screenName, requestedPlatform),
        }));
        const positions = getGenerationLayout([], screensWithDims);

        const MAX_CRITIQUE_ITERATIONS = 3;

        const generateScreenWithRetry = async (
          screen: string,
          position: { x: number; y: number },
          dimensions: { w: number; h: number },
          frameId: string,
          basePrompt: string,
        ): Promise<{
          success: boolean;
          code: string;
          error: string | null;
          iterations: number;
        }> => {
          let currentCode = "";
          let iterations = 0;
          let lastError: string | null = null;
          let pinnedModel: string | null = null;

          for (
            let iteration = 0;
            iteration < MAX_CRITIQUE_ITERATIONS;
            iteration++
          ) {
            iterations++;
            let screenGenerated = false;
            let streamErr: unknown = null;

            // Pin the first model that streams successfully. Only fall back to
            // other models when the pinned model itself errors (API failure).
            const modelsToTry: any = pinnedModel
              ? [
                  pinnedModel,
                  ...stage3ModelPriority.filter((m) => m !== pinnedModel),
                ]
              : stage3ModelPriority;

            for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
              const candidateModel = modelsToTry[modelIdx];
              try {
                if (modelIdx > 0 || iteration > 0) {
                  currentCode = "";
                  await write({
                    type: "screen_reset",
                    screen,
                    reason:
                      iteration > 0
                        ? `critique-retry:${iteration}`
                        : `retry:${candidateModel}`,
                  });
                }

                const promptWithFixes =
                  iteration > 0 && lastError
                    ? `${basePrompt}\n\nCRITICAL FIXES NEEDED:\n${lastError}`
                    : basePrompt;

                logger.info(
                  `Stage 3 screen '${screen}' iteration ${iteration} via model: ${candidateModel}`,
                );
                const { usage: stage3Usage, textStream } = streamText({
                  model: ollama(candidateModel),
                  system: STAGE3_SYSTEM,
                  prompt: buildScreenPrompt(
                    spec,
                    tree,
                    screen,
                    promptWithFixes,
                    designContext,
                  ),
                  temperature: 0.2,
                  abortSignal: abortController.signal,
                });

                for await (const token of textStream) {
                  if (abortController.signal.aborted) break;
                  currentCode += token;
                  await write({ type: "code_chunk", screen, token });
                }
                logger.info("Response stream complete for screen", {
                  usage: stage3Usage,
                });
                screenGenerated = true;
                if (!pinnedModel) pinnedModel = candidateModel;
                break;
              } catch (err) {
                streamErr = err;
                logger.warn(
                  `Stage 3 model failed for '${screen}' iteration ${iteration}: ${candidateModel}`,
                  err,
                );
                if ((err as Error)?.name === "AbortError") {
                  logger.info("Generation aborted due to client disconnect");
                  return {
                    success: false,
                    code: "",
                    error: "Aborted",
                    iterations,
                  };
                }
              }
            }

            if (!screenGenerated) {
              return {
                success: false,
                code: currentCode,
                error: `All models failed: ${String(streamErr)}`,
                iterations,
              };
            }

            const syntaxValidation = validateGeneratedTSX(currentCode);
            if (syntaxValidation.valid) {
              return {
                success: true,
                code: sanitizeGeneratedCode(currentCode),
                error: null,
                iterations,
              };
            }

            lastError = syntaxValidation.issues.join("; ");
            logger.info(
              `Screen '${screen}' TSX validation failed, retry ${iteration + 1}/${MAX_CRITIQUE_ITERATIONS}:`,
              {
                issues: lastError,
              },
            );

            await write({
              type: "quality_warning",
              screen,
              issues: syntaxValidation.issues,
              score: 0,
            });
          }

          const isValid = validateGeneratedTSX(currentCode).valid;
          return {
            success: isValid,
            code: sanitizeGeneratedCode(currentCode),
            error: isValid ? null : (lastError || "Max retries reached without valid TSX"),
            iterations,
          };
        };

        for (const [index, screen] of spec.screens.entries()) {
          await write({ type: "screen_start", screen });

          const position = positions[index] ?? {
            x: 100 + index * 40,
            y: 100 + index * 40,
          };
          const dimensions = screensWithDims[index] ?? { w: 1200, h: 800 };
          const frameId = crypto.randomUUID();

          const finalResult: any = await generateScreenWithRetry(
            screen,
            position,
            dimensions,
            frameId,
            stage3Prompt,
          );

          // Lenient quality check: warn only, never block persistence
          if (finalResult.success && finalResult.code) {
            const qualityCheck = performDesignQualityCheck(
              finalResult.code,
              spec,
            );

            if (!qualityCheck.passed) {
              logger.warn(
                `Screen "${screen}" quality warnings:`,
                qualityCheck.issues,
              );
              await write({
                type: "quality_warning",
                screen,
                issues: qualityCheck.issues,
                score: qualityCheck.score,
              });
            }
          }

          if (!finalResult.success) {
            persistedScreens.push({
              id: frameId,
              state: "error",
              x: position.x,
              y: position.y,
              w: dimensions.w,
              h: dimensions.h,
              screenName: screen,
              content: finalResult.code,
              editedContent: null,
              error: finalResult.error,
            });
            await write({ type: "screen_done", screen });
            continue;
          }

          persistedScreens.push({
            id: frameId,
            state: "done",
            x: position.x,
            y: position.y,
            w: dimensions.w,
            h: dimensions.h,
            screenName: screen,
            content: finalResult.code,
            editedContent: null,
            error: null,
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

const performDesignQualityCheck = (code: string, spec: WebAppSpec) => {
  const syntaxValidation = validateGeneratedTSX(code);
  const issues: string[] = [];
  let score = 10;

  // Only gate on compilation/runtime issues, not aesthetics
  if (!syntaxValidation.valid) {
    issues.push(...syntaxValidation.issues);
    score -= syntaxValidation.issues.length * 2;
  }

  // Major functional layout issue: web designs looking like mobile
  if (spec.platform === "web") {
    const hasNarrowContainer =
      /max-w-sm|max-w-md|max-w-xs|max-w-\[400px\]|max-w-\[500px\]|max-w-\[600px\]|w-96|w-80|w-72/.test(
        code,
      );
    const hasFullWidth =
      /max-w-\[1280px\]|max-w-\[1024px\]|max-w-7xl|max-w-6xl|w-full/.test(code);
    if (hasNarrowContainer && !hasFullWidth) {
      issues.push(
        "Layout: Web design appears mobile-narrow. Desktop layouts should use max-w-[1280px] or full-width.",
      );
      score -= 2;
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
};
