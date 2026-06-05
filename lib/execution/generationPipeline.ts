import { STAGE3_SYSTEM, buildScreenPrompt } from "@/lib/prompts";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";
import { validateGeneratedTSX } from "@/lib/validation/engine";
import { validateCompile } from "@/lib/validation/compileValidator";
import logger from "@/lib/logger";
import { PipelineContext, ScreenResult, OnScreenComplete } from "./types";
import { executeModel } from "./modelExecutor";

const MAX_CONCURRENT_SCREENS = 2;

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
  } = context;

  let lastError: string | null = null;
  let iterations = 0;
  let currentCode = "";

  for (const candidateModel of stage3ModelPriority) {
    if (abortController.signal.aborted) {
      return {
        success: false,
        code: currentCode,
        error: "Generation aborted by client disconnect",
        iterations,
      };
    }

    iterations++;

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
      system: STAGE3_SYSTEM,
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

    if (!result.success) {
      if (result.reason === "client_abort") {
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
      continue;
    }

    currentCode = result.code;
    // logger.info("Code : ", currentCode);
    // Layer 1: TS parser validation
    const tsValidation = validateGeneratedTSX(currentCode);
    if (!tsValidation.valid) {
      lastError = tsValidation.issues.join("; ");
      logger.info(
        `${eventPrefix} '${screen}' TSX validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: tsValidation.issues,
        score: 0,
      });
      continue;
    }

    // Layer 2: esbuild compile validation
    const sanitized = sanitizeGeneratedCode(currentCode);
    const compileValidation = await validateCompile(sanitized);
    if (!compileValidation.valid) {
      lastError = compileValidation.issues.join("; ");
      logger.info(
        `${eventPrefix} '${screen}' compile validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: compileValidation.issues,
        score: 0,
      });
      continue;
    }

    // Both validations passed
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
        (result) => {
          results[i + chunkIdx] = result;
          onScreenComplete?.(i + chunkIdx, result);
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
