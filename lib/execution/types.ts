import { ComponentTreeNode, DesignContext, WebAppSpec } from "@/lib/types";
import { initializeOllama } from "@/lib/ollama";
import type { ScreenClass } from "./modelRouter";

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResult {
  success: true;
  code: string;
  usage: ModelUsage | null;
}

export interface ModelFailure {
  success: false;
  reason: "client_abort" | "timeout" | "error";
  error: Error;
}

export type ModelExecutionResult = ModelResult | ModelFailure;

export interface ScreenResult {
  success: boolean;
  code: string;
  error: string | null;
  iterations: number;
}

export interface WriteFunction {
  (payload: object): Promise<void>;
}

export interface PipelineContext {
  ollama: ReturnType<typeof initializeOllama>;
  spec: WebAppSpec;
  tree: ComponentTreeNode[];
  designContext: DesignContext;
  stage3ModelPriority: string[];
  abortController: AbortController;
  write: WriteFunction;
  stage3Prompt: string;
  screenClass?: ScreenClass;
  generationId?: string | null;
}

export interface TelemetryPayload {
  generationId: string;
  screenName: string;
  model: string;
  stage: "stage3" | "repair" | "stage1" | "stage2";
  success: boolean;
  latencyMs: number;
  tokenCount: number | null;
  errorType: string | null;
  screenClass: ScreenClass | null;
}

export interface RepairResult {
  success: boolean;
  code: string;
  error: string | null;
}

export interface ModelExecutorOptions {
  ollama: ReturnType<typeof initializeOllama>;
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  abortController: AbortController;
  modelTimeoutMs?: number;
  onToken?: (token: string) => void | Promise<void>;
}

export type OnScreenComplete = (
  index: number,
  result: ScreenResult,
) => void | Promise<void>;
