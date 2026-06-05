import { ComponentTreeNode, DesignContext, WebAppSpec } from "@/lib/types";
import { initializeOllama } from "@/lib/ollama";

export interface ModelResult {
  success: true;
  code: string;
  usage: unknown;
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
