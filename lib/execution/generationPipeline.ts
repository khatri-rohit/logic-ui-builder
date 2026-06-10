import {
  PipelineContext,
  ScreenResult,
  OnScreenComplete,
  TelemetryPayload,
} from "@/lib/execution/types";
import { executeModel } from "@/lib/execution/modelExecutor";
import { classifyScreen, buildDynamicModelPriority } from "@/lib/execution/modelRouter";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";
import {
  buildScreenPrompt,
  STAGE3_SYSTEM,
  validateGeneratedTSX,
} from "@/lib/prompts";
import { validateCompile } from "@/lib/validation/compileValidator";

const MAX_CONCURRENT_SCREENS = 2;

async function logTelemetry(payload: TelemetryPayload) {
  if (!payload.generationId) return;
  try {
    await prisma.generationTelemetry.create({
      data: {
        generationId: payload.generationId,
        screenName: payload.screenName,
        model: payload.model,
        stage: payload.stage,
        success: payload.success,
        latencyMs: payload.latencyMs,
        tokenCount: payload.tokenCount,
        errorType: payload.errorType,
        screenClass: payload.screenClass,
      },
    });
  } catch (err) {
    logger.warn("Failed to write generation telemetry", err);
  }
}

export async function runScreenGeneration(
  context: PipelineContext,
  screen: string,
  frameId: string,
  basePrompt: string,
  eventPrefix: "screen" | "frame" = "screen",
): Promise<ScreenResult> {
  const {
    ollama,
    spec,
    tree,
    designContext,
    stage3ModelPriority,
    abortController,
    write,
    generationId,
  } = context;

  const MAX_STAGE3_ATTEMPTS = 3;

  const screenClass = classifyScreen(spec, screen, tree);

  // Dynamic model routing: re-rank priority for this screen's complexity class
  const dynamicPriority = await buildDynamicModelPriority(
    stage3ModelPriority,
    screenClass,
    null, // preferredModel is already at the front of stage3ModelPriority
  );

  let lastError: string | null = null;
  let iterations = 0;
  let currentCode = "";

  for (const candidateModel of dynamicPriority) {
    const attemptStart = Date.now();
    let errorType: string | null = null;

    if (abortController.signal.aborted) {
      return {
        success: false,
        code: currentCode,
        error: "Generation aborted by client disconnect",
        iterations,
      };
    }

    iterations++;

    if (iterations > MAX_STAGE3_ATTEMPTS) {
      logger.warn(
        `Stage 3 ${eventPrefix} '${screen}' exceeded max attempts (${MAX_STAGE3_ATTEMPTS}). Returning fallback.`,
      );
      return {
        success: false,
        code: sanitizeGeneratedCode(currentCode),
        error:
          lastError || `Exceeded max ${MAX_STAGE3_ATTEMPTS} stage-3 attempts`,
        iterations,
      };
    }

    if (iterations > 1) {
      currentCode = "";
      await write({
        type: `${eventPrefix}_reset`,
        screen,
        frameId,
        reason: lastError
          ? `validation-retry:${candidateModel}`
          : `retry:${candidateModel}`,
      });
    }

    const promptWithFixes = lastError
      ? `${basePrompt}\n\nCRITICAL FIXES NEEDED:\n${lastError}`
      : basePrompt;

    logger.info(
      `Stage 3 ${eventPrefix} '${screen}' attempt ${iterations} via model: ${candidateModel}`,
    );

    const result = await executeModel({
      ollama,
      model: candidateModel,
      system: context.systemPrompt || STAGE3_SYSTEM,
      prompt: buildScreenPrompt(
        spec,
        tree,
        screen,
        promptWithFixes,
        designContext,
      ),
      temperature: 0.2,
      abortController,
      async onToken(token) {
        await write({ type: "code_chunk", screen, frameId, token });
      },
    });

    const latencyMs = Date.now() - attemptStart;

    if (!result.success) {
      errorType =
        result.reason === "client_abort"
          ? "client_abort"
          : result.reason === "timeout"
            ? "timeout"
            : "model_error";

      if (result.reason === "client_abort") {
        void logTelemetry({
          generationId: generationId ?? "",
          screenName: screen,
          model: candidateModel,
          stage: "stage3",
          success: false,
          latencyMs,
          tokenCount: null,
          errorType,
          screenClass,
        });
        return {
          success: false,
          code: currentCode,
          error: "Generation aborted by client disconnect",
          iterations,
        };
      }

      logger.warn(
        `Stage 3 model failed for '${screen}': ${candidateModel} (reason: ${result.reason})`,
        result.error,
      );

      void logTelemetry({
        generationId: generationId ?? "",
        screenName: screen,
        model: candidateModel,
        stage: "stage3",
        success: false,
        latencyMs,
        tokenCount: null,
        errorType,
        screenClass,
      });
      continue;
    }

    currentCode = result.code
      .replace(/^```(?:tsx?|typescript|jsx?)?\n?/gm, "")
      .replace(/^```$/gm, "")
      .trim();
    // logger.info("Code: ", currentCode);
    // Layer 1: TS parser validation
    const tsValidation = validateGeneratedTSX(currentCode);
    if (!tsValidation.valid) {
      lastError = tsValidation.issues.join("; ");
      errorType = "parse_error";
      logger.info(
        `${eventPrefix} '${screen}' TSX validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: tsValidation.issues,
        score: 0,
      });
      void logTelemetry({
        generationId: generationId ?? "",
        screenName: screen,
        model: candidateModel,
        stage: "stage3",
        success: false,
        latencyMs,
        tokenCount: result.usage?.totalTokens ?? null,
        errorType,
        screenClass,
      });
      continue;
    }

    // Layer 2: esbuild compile validation
    const sanitized = sanitizeGeneratedCode(currentCode);
    const compileValidation = await validateCompile(sanitized);
    if (!compileValidation.valid) {
      lastError = compileValidation.issues.join("; ");
      errorType = "compile_error";
      logger.info(
        `${eventPrefix} '${screen}' compile validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: compileValidation.issues,
        score: 0,
      });
      void logTelemetry({
        generationId: generationId ?? "",
        screenName: screen,
        model: candidateModel,
        stage: "stage3",
        success: false,
        latencyMs,
        tokenCount: result.usage?.totalTokens ?? null,
        errorType,
        screenClass,
      });
      continue;
    }

    // Both validations passed
    void logTelemetry({
      generationId: generationId ?? "",
      screenName: screen,
      model: candidateModel,
      stage: "stage3",
      success: true,
      latencyMs,
      tokenCount: result.usage?.totalTokens ?? null,
      errorType: null,
      screenClass,
    });

    return {
      success: true,
      code: sanitized,
      error: null,
      iterations,
    };
  }

  // All models exhausted — return degraded fallback
  logger.warn(
    `All models exhausted for ${eventPrefix} '${screen}'. Returning fallback.`,
  );

  return {
    success: false,
    code: sanitizeGeneratedCode(currentCode),
    error: lastError || "All models failed without producing valid TSX",
    iterations,
  };
}

interface ScreenJob {
  screen: string;
  frameId: string;
  position: { x: number; y: number };
  dimensions: { w: number; h: number };
}

export async function runFullGeneration(
  context: PipelineContext,
  screens: ScreenJob[],
  basePrompt: string,
  onScreenComplete?: OnScreenComplete,
): Promise<ScreenResult[]> {
  const { write } = context;

  // Emit screen_start events in order so client initializes buffers
  for (const job of screens) {
    await write({
      type: "screen_start",
      screen: job.screen,
      frameId: job.frameId,
    });
  }

  const results: ScreenResult[] = new Array(screens.length);

  // Process screens in chunks of MAX_CONCURRENT_SCREENS
  for (let i = 0; i < screens.length; i += MAX_CONCURRENT_SCREENS) {
    const chunk = screens.slice(i, i + MAX_CONCURRENT_SCREENS);

    const promises = chunk.map((job, chunkIdx) =>
      runScreenGeneration(context, job.screen, job.frameId, basePrompt).then(
        async (result) => {
          results[i + chunkIdx] = result;
          await onScreenComplete?.(i + chunkIdx, result);
        },
      ),
    );

    await Promise.all(promises);
  }

  return results;
}

export async function runFrameRegeneration(
  context: PipelineContext,
  screen: string,
  frameId: string,
  basePrompt: string,
): Promise<ScreenResult> {
  await context.write({
    type: "frame_start",
    screen,
    frameId,
  });

  return runScreenGeneration(context, screen, frameId, basePrompt, "frame");
}
