import { STAGE3_SYSTEM, buildScreenPrompt } from "@/lib/prompts";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";
import { validateGeneratedTSX } from "@/lib/validation/engine";
import { validateCompile } from "@/lib/validation/compileValidator";
import logger from "@/lib/logger";
import {
  PipelineContext,
  ScreenResult,
  OnScreenComplete,
  TelemetryPayload,
} from "./types";
import { executeModel } from "./modelExecutor";
import { classifyScreen, ScreenClass, buildDynamicModelPriority } from "./modelRouter";
import { buildRepairPrompt } from "./repairPrompt";
import prisma from "@/lib/prisma";

const MAX_CONCURRENT_SCREENS = 2;

async function logTelemetry(payload: TelemetryPayload) {
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

async function attemptRepair(
  context: PipelineContext,
  screen: string,
  frameId: string,
  candidateModel: string,
  brokenCode: string,
  tsDiagnostics: ReturnType<typeof validateGeneratedTSX>["diagnostics"],
  compileDiagnostics: Awaited<ReturnType<typeof validateCompile>>["diagnostics"],
  eventPrefix: "screen" | "frame",
): Promise<{ success: boolean; code: string } | null> {
  const { ollama, abortController, write } = context;

  if (abortController.signal.aborted) {
    return null;
  }

  logger.info(
    `Attempting repair for '${screen}' on ${candidateModel} before falling back`,
  );

  await write({
    type: `${eventPrefix}_reset`,
    screen,
    frameId,
    reason: `repair:${candidateModel}`,
  });

  const { system, prompt } = buildRepairPrompt(
    brokenCode,
    { tsDiagnostics, compileDiagnostics },
    STAGE3_SYSTEM,
    context.stage3Prompt,
  );

  const repairStart = Date.now();
  const repairResult = await executeModel({
    ollama,
    model: candidateModel,
    system,
    prompt,
    temperature: 0.1,
    abortController,
    async onToken(token) {
      await write({ type: "code_chunk", screen, frameId, token });
    },
  });

  if (!repairResult.success || abortController.signal.aborted) {
    return null;
  }

  const repairedCode = sanitizeGeneratedCode(repairResult.code);
  const tsValidation = validateGeneratedTSX(repairedCode);
  if (!tsValidation.valid) {
    logger.info(
      `Repair attempt failed TSX validation on ${candidateModel}: ${tsValidation.issues.join("; ")}`,
    );
    return { success: false, code: repairedCode };
  }

  const compileValidation = await validateCompile(repairedCode);
  if (!compileValidation.valid) {
    logger.info(
      `Repair attempt failed compile validation on ${candidateModel}: ${compileValidation.issues.join("; ")}`,
    );
    return { success: false, code: repairedCode };
  }

  logger.info(`Repair succeeded on ${candidateModel}`);
  return { success: true, code: repairedCode };
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

    currentCode = result.code;
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

      // Attempt repair before falling back to next model
      const repair = await attemptRepair(
        context,
        screen,
        frameId,
        candidateModel,
        currentCode,
        tsValidation.diagnostics,
        [],
        eventPrefix,
      );

      const repairLatency = Date.now() - attemptStart;

      if (repair?.success) {
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
        void logTelemetry({
          generationId: generationId ?? "",
          screenName: screen,
          model: candidateModel,
          stage: "repair",
          success: true,
          latencyMs: repairLatency,
          tokenCount: null,
          errorType: null,
          screenClass,
        });
        return {
          success: true,
          code: repair.code,
          error: null,
          iterations,
        };
      }

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
      if (repair) {
        void logTelemetry({
          generationId: generationId ?? "",
          screenName: screen,
          model: candidateModel,
          stage: "repair",
          success: false,
          latencyMs: repairLatency,
          tokenCount: null,
          errorType: "parse_error",
          screenClass,
        });
      }
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

      // Attempt repair before falling back to next model
      const repair = await attemptRepair(
        context,
        screen,
        frameId,
        candidateModel,
        sanitized,
        [],
        compileValidation.diagnostics,
        eventPrefix,
      );

      const repairLatency = Date.now() - attemptStart;

      if (repair?.success) {
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
        void logTelemetry({
          generationId: generationId ?? "",
          screenName: screen,
          model: candidateModel,
          stage: "repair",
          success: true,
          latencyMs: repairLatency,
          tokenCount: null,
          errorType: null,
          screenClass,
        });
        return {
          success: true,
          code: repair.code,
          error: null,
          iterations,
        };
      }

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
      if (repair) {
        void logTelemetry({
          generationId: generationId ?? "",
          screenName: screen,
          model: candidateModel,
          stage: "repair",
          success: false,
          latencyMs: repairLatency,
          tokenCount: null,
          errorType: "compile_error",
          screenClass,
        });
      }
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
