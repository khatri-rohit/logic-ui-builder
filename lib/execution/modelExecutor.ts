import { streamText } from "ai";
import {
  ModelExecutionResult,
  ModelExecutorOptions,
} from "@/lib/execution/types";

const DEFAULT_MODEL_TIMEOUT_MS = 300_000;

export async function executeModel(
  options: ModelExecutorOptions,
): Promise<ModelExecutionResult> {
  const {
    ollama,
    model,
    system,
    prompt,
    temperature,
    maxOutputTokens,
    abortController,
    modelTimeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
  } = options;

  try {
    const modelSignal = createModelAbortSignal(abortController, modelTimeoutMs);
    const { usage, textStream } = streamText({
      model: ollama(model),
      system,
      prompt,
      temperature,
      ...(typeof maxOutputTokens === "number"
        ? { maxOutputTokens }
        : {}),
      abortSignal: modelSignal,
    });

    let code = "";
    for await (const token of textStream) {
      if (abortController.signal.aborted) break;
      code += token;
      await options.onToken?.(token);
    }

    if (abortController.signal.aborted) {
      return {
        success: false,
        reason: "client_abort",
        error: new Error("Generation aborted by client disconnect"),
      };
    }

    let resolvedUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    try {
      const u = await usage;
      const pt = (u as { promptTokens?: number }).promptTokens ?? 0;
      const ct = (u as { completionTokens?: number }).completionTokens ?? 0;
      const tt = (u as { totalTokens?: number }).totalTokens ?? pt + ct;
      resolvedUsage = {
        promptTokens: pt,
        completionTokens: ct,
        totalTokens: tt,
      };
    } catch {
      resolvedUsage = null;
    }

    return { success: true, code, usage: resolvedUsage };
  } catch (err) {
    const clientAborted = abortController.signal.aborted;
    const timeoutAborted =
      !clientAborted && (err as Error)?.name === "AbortError";

    if (clientAborted) {
      return {
        success: false,
        reason: "client_abort",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }

    if (timeoutAborted) {
      return {
        success: false,
        reason: "timeout",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }

    return {
      success: false,
      reason: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

function createModelAbortSignal(
  controller: AbortController,
  timeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
    timeoutController.abort();
  });

  return timeoutController.signal;
}
