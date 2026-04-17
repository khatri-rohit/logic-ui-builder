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

const MAX_PROMPT_LENGTH = 10000;
const MAX_MODEL_NAME_LENGTH = 80;

function normalizePlatform(value: unknown): GenerationPlatform {
  return value === "mobile" ? "mobile" : "web";
}

function normalizeModelPreference(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_MODEL_NAME_LENGTH) return null;

  return normalized;
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

    let body: {
      prompt?: unknown;
      platform?: unknown;
      model?: unknown;
    };

    try {
      body = (await req.json()) as {
        prompt?: unknown;
        platform?: unknown;
        model?: unknown;
      };
    } catch {
      return NextResponse.json(
        {
          error: true,
          message: "Request body must be valid JSON",
        },
        { status: 400 },
      );
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        {
          error: true,
          message: "Prompt is required",
        },
        { status: 400 },
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        {
          error: true,
          message: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    const preferredModel = normalizeModelPreference(body.model);
    if (body.model !== undefined && !preferredModel) {
      return NextResponse.json(
        {
          error: true,
          message: "Invalid model value",
        },
        { status: 400 },
      );
    }

    if (preferredModel && !STAGE3_MODELS.includes(preferredModel)) {
      return NextResponse.json(
        {
          error: true,
          message: "Unsupported model selection",
        },
        { status: 400 },
      );
    }

    const requestedPlatform = normalizePlatform(body.platform);
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
      try {
        // Stage 1 — structured spec extraction (non-streaming)
        // generateText = wait for full response, no stream
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
        logger.info("Stage 1 complete");
        await write({ type: "design_context", designContext });
        await write({ type: "spec", spec });

        // Stage 2 — component planner (non-streaming)
        logger.info("Starting Stage 2: Component Planner");
        const { text: rawTree } = await generateTextWithFallback({
          stage: "Stage 2 Component Planner",
          models: stage2ModelPriority,
          ollama,
          system: STAGE2_SYSTEM,
          prompt: `${requestedPlatform}Spec: ${JSON.stringify(spec)}\n${designContextText}`,
        });
        const tree = parseJsonStrict<ComponentTreeNode[]>(rawTree);
        logger.info("Stage 2 complete");
        await write({ type: "tree", tree });

        // Stage 3 — code synthesis per screen (streaming)
        logger.info("Starting Stage 3: Code Synthesis");
        for (const screen of spec.screens) {
          await write({ type: "screen_start", screen });

          let screenGenerated = false;
          let streamErr: unknown = null;

          for (let i = 0; i < stage3ModelPriority.length; i++) {
            const candidateModel = stage3ModelPriority[i];
            try {
              if (i > 0) {
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

              logger.info(
                "Awaiting stream of code chunks for screen: ",
                screen,
              );

              for await (const token of result.textStream) {
                await write({ type: "code_chunk", screen, token });
              }
              // logger.info("Result output: ", await result.output);

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
            await write({ type: "screen_done", screen });
            throw new Error(
              `All stage 3 models failed for ${screen}: ${String(streamErr)}`,
            );
          }

          await write({ type: "screen_done", screen });
        }

        logger.info("Generation complete");
        await write({ type: "done" });
      } catch (err) {
        await write({ type: "error", message: String(err) });
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
