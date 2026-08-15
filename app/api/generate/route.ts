/**
 * POST /api/generate
 *
 * Called by ProjectStudioClient.handleGenerate for:
 * - Full multi-screen generation (Stage 1 → 2 → 3)
 * - G-mode + selected frame: createNewFrame sibling (Stage 3 only)
 *
 * In-place frame regenerate is POST /api/generate/[frameId] (handleFrame).
 */
import {
  GenerationPlatform as PrismaGenerationPlatform,
  Prisma,
} from "@/app/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { initializeOllama } from "@/lib/ollama";

import { generateText, Output } from "ai";
import {
  GENERATED_SCREEN_LIMITS,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  composeStage3SystemPrompt,
  validateGeneratedTSX,
} from "@/lib/prompts";
import { ComponentTreeNode, GenerationPlatform, WebAppSpec } from "@/lib/types";
import logger from "@/lib/logger";
import {
  buildEnhancedPrompt,
  buildFrameRegeneratePrompt,
} from "@/lib/promptEnhancer";
import { buildDesignContext, toDesignContextText } from "@/lib/designContext";
import { withDesignSystem } from "@/lib/designSystemSnapshot";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import { getGenerationBurstLimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import {
  componentTreeNodeSchema,
  componentTreeSchema,
  generationRequestBodySchema,
  stage1SpecOutputSchema,
  toValidationIssues,
  webAppSpecSchema,
} from "@/lib/schemas/studio";
import { coerceWebAppSpec } from "@/lib/execution/coerceSpec";
import {
  STAGE1_MODELS,
  STAGE2_MODELS,
  STAGE3_MODELS,
  getStageDecoding,
  type GenerationDecodingStage,
} from "@/lib/execution/modelDefaults";

import {
  collectBoundsFromGenerations,
  getGenerationLayout,
  getInitialDimensionsForPlatform,
  mergeExistingFrameBounds,
} from "@/lib/canvasLayout";
import { PersistedGenerationScreen } from "@/lib/canvas-state";
import { parseGenerationScreens } from "@/lib/utils";
import { z } from "zod";
import { guardGenerationRequest } from "@/lib/plan-guard";
import {
  toApiPlatform,
  toPrismaPlatform,
  buildModelPriority,
  reserveGenerationWithIdempotency,
} from "@/lib/generation";
import { releaseGenerationSlot } from "@/lib/usage";
import {
  runFullGeneration,
  runScreenGeneration,
} from "@/lib/execution/generationPipeline";
import type { PipelineContext } from "@/lib/execution/types";
import { buildDesignContract } from "@/lib/designContract";
import { ensureSandboxSafeCode } from "@/lib/sandboxSafeCode";

export const runtime = "nodejs";

const generationBodySchema = generationRequestBodySchema;

const idempotencyHeaderSchema = z.string().trim().min(8).max(128);

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

function isValidComponentTree(
  tree: unknown,
  expectedScreens: string[],
): tree is ComponentTreeNode[] {
  const parsed = componentTreeSchema.safeParse(tree);
  if (!parsed.success) return false;
  return parsed.data.every((item) => expectedScreens.includes(item.screen));
}

async function generateStructuredWithFallback<T>({
  stage,
  models,
  ollama,
  system,
  prompt,
  abortSignal,
  decodingStage,
  output,
}: {
  stage: string;
  models: string[];
  ollama: ReturnType<typeof initializeOllama>;
  system: string;
  prompt: string;
  abortSignal?: AbortSignal;
  decodingStage: GenerationDecodingStage;
  // AI SDK Output.object / Output.array configuration
  output: NonNullable<Parameters<typeof generateText>[0]["output"]>;
}): Promise<{
  output: T;
  usage: Awaited<ReturnType<typeof generateText>>["usage"];
}> {
  let lastError: unknown = null;
  const decoding = getStageDecoding(decodingStage);

  for (const model of models) {
    try {
      logger.info(
        `${stage} via model: ${model} (temp=${decoding.temperature})`,
      );
      const result = await generateText({
        model: ollama(model),
        system,
        prompt,
        temperature: decoding.temperature,
        maxOutputTokens: decoding.maxOutputTokens,
        abortSignal,
        output,
      });

      if (result.output == null) {
        throw new Error(`${stage} produced empty structured output`);
      }

      return {
        output: result.output as T,
        usage: result.usage,
      };
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

    const hasFrameContext = !!body.frameId && !!body.generationId;
    // In-place regenerate belongs on POST /api/generate/[frameId].
    if (hasFrameContext && !body.createNewFrame) {
      return NextResponse.json(
        {
          error: true,
          code: "USE_FRAME_REGENERATE_ROUTE",
          message:
            "In-place frame regeneration must use POST /api/generate/[frameId]. Use createNewFrame for sibling frames.",
          data: null,
        },
        { status: 400 },
      );
    }

    const createNewFrameWithContext = hasFrameContext && !!body.createNewFrame;
    const targetFrameId = createNewFrameWithContext
      ? crypto.randomUUID()
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

    if (createNewFrameWithContext) {
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

    const guardResult = await guardGenerationRequest(authContext);
    if (!guardResult.allowed) return guardResult.response;
    const { usage } = guardResult;
    if (!usage) {
      return NextResponse.json(
        {
          error: true,
          code: "USAGE_UNAVAILABLE",
          message: "Usage context missing.",
        },
        { status: 503 },
      );
    }
    logger.info("Plan guard passed for generation request", { usage });

    const requestedPlatform =
      createNewFrameWithContext && sourceGeneration
        ? toApiPlatform(sourceGeneration.platform)
        : toApiPlatform(project.platform);
    const prompt = body.prompt.trim();

    let designContext: Awaited<ReturnType<typeof buildDesignContext>>;
    let stage3Prompt: string;
    let designContextText: string;

    if (createNewFrameWithContext && sourceGeneration) {
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

    const requestedModelForPersistence =
      createNewFrameWithContext && sourceGeneration
        ? (preferredModel ?? sourceGeneration.model)
        : (preferredModel ?? stage3ModelPriority[0]);

    let generationId: string | null = null;

    // Atomic idempotent generation reservation
    const idempotencyResult = await prisma.$transaction(async (tx) => {
      const result = await reserveGenerationWithIdempotency(tx, {
        projectId: project.id,
        prompt:
          createNewFrameWithContext && sourceGeneration
            ? prompt || sourceGeneration.prompt
            : prompt,
        model: requestedModelForPersistence,
        platform:
          createNewFrameWithContext && sourceGeneration
            ? sourceGeneration.platform
            : toPrismaPlatform(requestedPlatform),
        spec:
          createNewFrameWithContext && sourceGeneration
            ? (sourceGeneration.spec as unknown as Prisma.InputJsonValue)
            : ({} as Prisma.InputJsonValue),
        tree:
          createNewFrameWithContext && sourceGeneration
            ? (sourceGeneration.tree as Prisma.InputJsonValue | undefined)
            : undefined,
        idempotencyKey,
      });

      if (result.isNew) {
        await tx.project.update({
          where: { id: project.id },
          data: { status: "GENERATING" },
        });
      }

      return result;
    });

    if (!idempotencyResult.isNew) {
      await releaseGenerationSlot(usage.usagePeriodId);
      return NextResponse.json(
        {
          error: true,
          code: "DUPLICATE_GENERATION_REQUEST",
          message: "Duplicate generation request rejected by idempotency key",
          data: {
            generationId: idempotencyResult.generationId,
            status: idempotencyResult.status,
          },
        },
        { status: 409 },
      );
    }

    generationId = idempotencyResult.generationId;

    const ollama = initializeOllama();

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      const persistedScreens: PersistedGenerationScreen[] = [];

      try {
        // createNewFrame from selected frame context — skip Stage 1 & 2
        if (createNewFrameWithContext && sourceGeneration && sourceFrame) {
          logger.info("createNewFrame: skipping Stage 1 & 2", {
            generationId,
            frameId: body.frameId,
            screenName: sourceFrame.screenName,
          });

          const regenerationFrameId = targetFrameId ?? crypto.randomUUID();
          const framePosX = sourceFrame.x + 40;
          const framePosY = sourceFrame.y + 40;

          // Pre-populate with an error placeholder so the outer catch handler
          // always writes a valid frame record if the stream is interrupted.
          persistedScreens.push({
            id: regenerationFrameId,
            state: "error",
            x: framePosX,
            y: framePosY,
            w: sourceFrame.w,
            h: sourceFrame.h,
            screenName: sourceFrame.screenName,
            content: "",
            editedContent: null,
            error: "Generation was interrupted before this screen completed.",
          });

          await write({ type: "generation_id", generationId });

          await write({
            type: "layout",
            layout: [
              {
                screen: sourceFrame.screenName,
                frameId: regenerationFrameId,
                x: framePosX,
                y: framePosY,
                w: sourceFrame.w,
                h: sourceFrame.h,
              },
            ],
            platform: toApiPlatform(sourceGeneration.platform),
          });

          const sourcePlatform = toApiPlatform(sourceGeneration.platform);

          const storedTree = (() => {
            if (!sourceGeneration.tree) return null;
            try {
              const parsed = componentTreeSchema.safeParse(
                sourceGeneration.tree,
              );
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
          const spec: WebAppSpec = withDesignSystem(
            webAppSpecParsed.success
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
                },
          );

          const framePipelineContext: PipelineContext = {
            ollama,
            spec,
            tree,
            designContext,
            stage3ModelPriority,
            abortController,
            write,
            systemPrompt: composeStage3SystemPrompt(spec, designContext),
            generationId,
            designContract: buildDesignContract(spec, designContext),
          };

          const frameResult = await runScreenGeneration(
            framePipelineContext,
            sourceFrame.screenName,
            regenerationFrameId,
            stage3Prompt,
            "screen",
            { w: sourceFrame.w, h: sourceFrame.h },
          );

          const safe = await ensureSandboxSafeCode(frameResult.code);

          persistedScreens[0] = {
            id: regenerationFrameId,
            state: "done",
            x: framePosX,
            y: framePosY,
            w: sourceFrame.w,
            h: sourceFrame.h,
            screenName: sourceFrame.screenName,
            content: safe.code,
            editedContent: null,
            error: null,
          };

          await write({
            type: "screen_done",
            screen: sourceFrame.screenName,
            frameId: regenerationFrameId,
            content: safe.code,
            error: null,
          });

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

          logger.info("createNewFrame complete", {
            generationId,
            frameId: body.frameId,
            screenName: sourceFrame.screenName,
          });
          await write({ type: "done" });
          return;
        }

        // Normal full generation flow - Stage 1, 2, 3
        logger.info("Starting Stage 1: Spec Extraction");

        const { output: rawParsedSpec, usage: stage1Usage } =
          await generateStructuredWithFallback<
            Partial<WebAppSpec> & { screens: string[] }
          >({
            stage: "Stage 1 Spec Extraction",
            models: stage1ModelPriority,
            ollama,
            system: STAGE1_SYSTEM,
            prompt: `User prompt: ${prompt}\nPlatform: ${requestedPlatform}\n${designContextText}`,
            abortSignal: abortController.signal,
            decodingStage: "stage1",
            output: Output.object({ schema: stage1SpecOutputSchema }),
          });

        let spec = splitMobileScreensIfNeeded(
          coerceSpec(rawParsedSpec, requestedPlatform),
          prompt,
        );

        // Lock Design System Snapshot from Stage 1 intent (no mid-pipeline color overrides)
        spec = withDesignSystem(spec);

        const designContract = buildDesignContract(spec, designContext);

        logger.info("Stage 1 Spec Extraction complete", { usage: stage1Usage });

        await prisma.generation.update({
          where: { id: generationId },
          data: { spec: spec as unknown as Prisma.InputJsonValue },
        });

        await write({ type: "generation_id", generationId });
        await write({ type: "design_context", designContext });
        await write({ type: "spec", spec });

        logger.info("Stage 2: Component Planner");
        let tree: ComponentTreeNode[] = [];
        let treeUsage:
          | Awaited<ReturnType<typeof generateStructuredWithFallback>>["usage"]
          | null = null;
        try {
          const stage2Result =
            await generateStructuredWithFallback<ComponentTreeNode[]>({
              stage: "Stage 2 Component Planner",
              models: stage2ModelPriority,
              ollama,
              system: STAGE2_SYSTEM,
              prompt: `${requestedPlatform}Spec: ${JSON.stringify(spec)}\n${designContextText}`,
              abortSignal: abortController.signal,
              decodingStage: "stage2",
              output: Output.array({
                element: componentTreeNodeSchema,
              }),
            });
          tree = stage2Result.output;
          treeUsage = stage2Result.usage;
        } catch (stage2Error) {
          logger.warn(
            "Stage 2 structured generation failed; constructing fallback from spec screens",
            stage2Error,
          );
        }

        if (!isValidComponentTree(tree, spec.screens)) {
          logger.warn(
            "Stage 2 produced invalid tree; constructing fallback from spec screens",
          );
          tree = spec.screens.map((screen) => ({
            screen,
            components: spec.components ?? [],
          }));
        }
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

        const existingGenerations = await prisma.generation.findMany({
          where: { projectId: project.id },
          select: { id: true, screens: true },
        });

        const dbBounds = collectBoundsFromGenerations(
          existingGenerations.map((gen) => ({
            id: gen.id,
            screens: parseGenerationScreens(gen.screens),
          })),
          generationId,
        );

        const liveBounds = (body.canvasFrames ?? []).map((frame) => ({
          id: frame.id,
          x: frame.x,
          y: frame.y,
          w: frame.w,
          h: frame.h,
        }));

        // Prefer live canvas geometry (auto-fit heights) over stale DB artboard heights.
        const existingFrameBounds = mergeExistingFrameBounds(
          dbBounds,
          liveBounds,
        );

        const positions = getGenerationLayout(
          existingFrameBounds,
          screensWithDims,
        );

        const frameAssignments = screensWithDims.map((screen, index) => ({
          screen: screen.name,
          frameId: crypto.randomUUID(),
          x: positions[index]?.x ?? 100 + index * 40,
          y: positions[index]?.y ?? 100 + index * 40,
          w: screen.w,
          h: screen.h,
        }));

        await write({
          type: "layout",
          layout: frameAssignments,
          platform: requestedPlatform,
        });

        // Pre-populate persistedScreens with error placeholders so the abort
        // handler always writes a complete set — no frames are ever lost.
        persistedScreens.push(
          ...frameAssignments.map((a) => ({
            id: a.frameId,
            state: "error" as const,
            x: a.x,
            y: a.y,
            w: a.w,
            h: a.h,
            screenName: a.screen,
            content: "",
            editedContent: null,
            error: "Generation was interrupted before this screen completed.",
          })),
        );

        const pipelineContext: PipelineContext = {
          ollama,
          spec,
          tree,
          designContext,
          stage3ModelPriority,
          abortController,
          write,
          systemPrompt: composeStage3SystemPrompt(spec, designContext),
          generationId,
          designContract,
        };

        const screenJobs = frameAssignments.map((a) => ({
          screen: a.screen,
          frameId: a.frameId,
          position: { x: a.x, y: a.y },
          dimensions: { w: a.w, h: a.h },
        }));

        const onScreenComplete = async (
          i: number,
          finalResult: Awaited<ReturnType<typeof runScreenGeneration>>,
        ) => {
          const screen = spec.screens[i];
          const assignment = frameAssignments[i];

          // Lenient quality check: warn only, never block persistence
          if (finalResult.success && finalResult.code) {
            const qualityCheck = performDesignQualityCheck(
              finalResult.code,
              spec,
              assignment.w,
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

          const safe = await ensureSandboxSafeCode(finalResult.code);

          persistedScreens[i] = {
            id: assignment.frameId,
            state: "done",
            x: assignment.x,
            y: assignment.y,
            w: assignment.w,
            h: assignment.h,
            screenName: screen,
            content: safe.code,
            editedContent: null,
            error: null,
          };

          await write({
            type: "screen_done",
            screen,
            frameId: assignment.frameId,
            content: safe.code,
            error: null,
          });

          // Eager DB persistence: write completed screens immediately so a
          // mid-generation disconnect doesn't lose already-finished frames.
          if (generationId) {
            await prisma.generation.update({
              where: { id: generationId },
              data: {
                screens: persistedScreens as unknown as Prisma.InputJsonValue,
              },
            });
          }
        };

        await runFullGeneration(
          pipelineContext,
          screenJobs,
          stage3Prompt,
          onScreenComplete,
        );

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
        const isAbort =
          abortController.signal.aborted ||
          (err as Error)?.name === "AbortError" ||
          (err as Error)?.message === "Aborted by client disconnect";
        const message = isAbort
          ? "Aborted by client disconnect"
          : err instanceof Error
            ? err.message
            : String(err);

        // Ensure any placeholder error messages reflect the actual failure reason
        if (isAbort) {
          for (const screen of persistedScreens) {
            if (screen.state === "error") {
              screen.error = message;
            }
          }
        }

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
                  stage: isAbort ? "abort" : "stream",
                } as unknown as Prisma.InputJsonValue,
              },
            }),
            prisma.project.update({
              where: { id: project.id },
              data: { status: "ACTIVE" },
            }),
          ]);
        }

        if (!isAbort && usage) {
          await releaseGenerationSlot(usage.usagePeriodId);
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

const performDesignQualityCheck = (
  code: string,
  spec: WebAppSpec,
  viewportWidth?: number,
) => {
  const syntaxValidation = validateGeneratedTSX(code);
  const issues: string[] = [];
  let score = 10;

  // Only gate on compilation/runtime issues, not aesthetics
  if (!syntaxValidation.valid) {
    issues.push(...syntaxValidation.issues);
    score -= syntaxValidation.issues.length * 2;
  }

  // Major functional layout issue: web designs looking like mobile on wide artboards
  const artboardW = viewportWidth ?? (spec.platform === "web" ? 1440 : 390);
  if (spec.platform === "web" && artboardW >= 1024) {
    const hasNarrowContainer =
      /max-w-sm|max-w-md|max-w-xs|max-w-\[400px\]|max-w-\[500px\]|max-w-\[600px\]|w-96|w-80|w-72/.test(
        code,
      );
    const hasFullWidth =
      /max-w-\[1440px\]|max-w-\[1280px\]|max-w-7xl|max-w-6xl|w-full/.test(code);
    if (hasNarrowContainer && !hasFullWidth) {
      issues.push(
        "Layout: Web design appears mobile-narrow. Desktop layouts should use max-w-[1440px] or full-width.",
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
