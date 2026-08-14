import {
  PipelineContext,
  ScreenResult,
  OnScreenComplete,
  TelemetryPayload,
} from "@/lib/execution/types";
import { executeModel } from "@/lib/execution/modelExecutor";
import { classifyScreen, buildDynamicModelPriority } from "@/lib/execution/modelRouter";
import { getStage3Decoding } from "@/lib/execution/modelDefaults";
import {
  extractVisualFingerprint,
  isWeakDesignAnchor,
  pickDesignAnchorIndex,
} from "@/lib/designContract";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";
import { extractDependencies } from "@/lib/dependencyExtractor";
import { ensureSandboxSafeCode } from "@/lib/sandboxSafeCode";
import {
  buildScreenPrompt,
  composeStage3SystemPrompt,
  validateGeneratedTSX,
} from "@/lib/prompts";
import {
  ensureDesignTokensOnRoot,
  resolveDesignSystem,
} from "@/lib/designSystemSnapshot";
import { validateCompile } from "@/lib/validation/compileValidator";
import { validateSandboxBindings } from "@/lib/validation/sandboxBindings";
import { validateSandboxRuntimeHazards } from "@/lib/validation/sandboxRuntimeHazards";

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

function applyReferenceFromResult(
  context: PipelineContext,
  result: ScreenResult,
  screenName: string,
  allowWeakAnchor: boolean,
) {
  if (!result.success || !result.code) return false;
  if (context.referenceScreenCode) return false;
  if (!allowWeakAnchor && isWeakDesignAnchor(screenName)) return false;

  context.referenceScreenCode = result.code;
  context.visualFingerprint = extractVisualFingerprint(result.code);
  return true;
}

export async function runScreenGeneration(
  context: PipelineContext,
  screen: string,
  frameId: string,
  basePrompt: string,
  eventPrefix: "screen" | "frame" = "screen",
  viewport?: { w: number; h: number },
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
  const isFrameRegen = eventPrefix === "frame";

  const screenClass = classifyScreen(spec, screen, tree);

  const dynamicPriority = await buildDynamicModelPriority(
    stage3ModelPriority,
    screenClass,
    null,
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
      const safe = await ensureSandboxSafeCode(currentCode);
      return {
        success: true,
        code: safe.code,
        error: null,
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

    const decoding = getStage3Decoding({
      hasReference: Boolean(context.referenceScreenCode),
      isValidationRetry: Boolean(lastError),
      isFrameRegen,
    });

    logger.info(
      `Stage 3 ${eventPrefix} '${screen}' attempt ${iterations} via model: ${candidateModel} (temp=${decoding.temperature})`,
    );

    const result = await executeModel({
      ollama,
      model: candidateModel,
      system:
        context.systemPrompt ||
        composeStage3SystemPrompt(spec, designContext),
      prompt: buildScreenPrompt(
        spec,
        tree,
        screen,
        promptWithFixes,
        designContext,
        context.referenceScreenCode,
        viewport,
        context.designContract,
        context.visualFingerprint,
      ),
      temperature: decoding.temperature,
      maxOutputTokens: decoding.maxOutputTokens,
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

    const bindingValidation = validateSandboxBindings(sanitized);
    if (!bindingValidation.valid) {
      lastError = bindingValidation.issues.join("; ");
      errorType = "binding_error";
      logger.info(
        `${eventPrefix} '${screen}' sandbox binding validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: bindingValidation.issues,
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

    const hazardValidation = validateSandboxRuntimeHazards(sanitized);
    if (!hazardValidation.valid) {
      lastError = hazardValidation.issues.join("; ");
      errorType = "runtime_hazard";
      logger.info(
        `${eventPrefix} '${screen}' sandbox runtime hazard on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: hazardValidation.issues,
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

    const deps = extractDependencies(sanitized);
    if (deps.unknownPackages.length > 0) {
      lastError = `Unsupported sandbox packages: ${deps.unknownPackages.join(", ")}`;
      errorType = "dependency_error";
      logger.info(
        `${eventPrefix} '${screen}' sandbox dependency validation failed on ${candidateModel}: ${lastError}`,
      );
      await write({
        type: "quality_warning",
        screen,
        issues: [lastError],
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

    const snapshot = resolveDesignSystem(spec);
    const baked = ensureDesignTokensOnRoot(sanitized, snapshot);
    const safe = await ensureSandboxSafeCode(baked);

    return {
      success: true,
      code: safe.code,
      error: null,
      iterations,
    };
  }

  logger.warn(
    `All models exhausted for ${eventPrefix} '${screen}'. Returning fallback.`,
  );

  const safe = await ensureSandboxSafeCode(currentCode);
  return {
    success: true,
    code: safe.code,
    error: null,
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

  for (const job of screens) {
    await write({
      type: "screen_start",
      screen: job.screen,
      frameId: job.frameId,
    });
  }

  const results: ScreenResult[] = new Array(screens.length);
  if (screens.length === 0) return results;

  const hasNonWeakAnchor = screens.some(
    (job) => !isWeakDesignAnchor(job.screen),
  );
  const anchorIndex = pickDesignAnchorIndex(screens.map((job) => job.screen));

  // Generate the design-anchor screen first (e.g. dashboard before login).
  const serialOrder = [
    anchorIndex,
    ...screens.map((_, i) => i).filter((i) => i !== anchorIndex),
  ];

  logger.info("Stage 3 design anchor selected", {
    anchorScreen: screens[anchorIndex]?.screen,
    anchorIndex,
  });

  for (const i of serialOrder) {
    if (results[i]) continue;

    const job = screens[i];
    const result = await runScreenGeneration(
      context,
      job.screen,
      job.frameId,
      basePrompt,
      "screen",
      job.dimensions,
    );
    results[i] = result;
    await onScreenComplete?.(i, result);

    const applied = applyReferenceFromResult(
      context,
      result,
      job.screen,
      !hasNonWeakAnchor,
    );

    // Once we have a usable reference, stop serial phase.
    if (applied) break;

    // Keep going if this was a weak auth/splash screen or a failure.
  }

  const pending = screens
    .map((_, i) => i)
    .filter((i) => results[i] === undefined);

  for (let offset = 0; offset < pending.length; offset += MAX_CONCURRENT_SCREENS) {
    const chunk = pending.slice(offset, offset + MAX_CONCURRENT_SCREENS);

    await Promise.all(
      chunk.map(async (i) => {
        const job = screens[i];
        const result = await runScreenGeneration(
          context,
          job.screen,
          job.frameId,
          basePrompt,
          "screen",
          job.dimensions,
        );
        results[i] = result;
        await onScreenComplete?.(i, result);
      }),
    );
  }

  return results;
}

export async function runFrameRegeneration(
  context: PipelineContext,
  screen: string,
  frameId: string,
  basePrompt: string,
  viewport?: { w: number; h: number },
): Promise<ScreenResult> {
  await context.write({
    type: "frame_start",
    screen,
    frameId,
  });

  return runScreenGeneration(
    context,
    screen,
    frameId,
    basePrompt,
    "frame",
    viewport,
  );
}
