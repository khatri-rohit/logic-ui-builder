import type { PersistedGenerationScreen } from "@/lib/canvas-state";
import { isProbablyCompleteScreen } from "@/lib/sandboxFallbackScreen";
import type { GenerationPlatform, WebAppSpec } from "@/lib/types";

export type GenerationEvent =
  | { type: "generation_id"; generationId: string }
  | {
      type: "layout";
      layout: Array<{
        screen: string;
        frameId: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }>;
      platform: GenerationPlatform;
    }
  | { type: "spec"; spec: WebAppSpec }
  | { type: "screen_start"; screen: string; frameId: string }
  | { type: "screen_reset"; screen: string; frameId: string; reason?: string }
  | { type: "code_chunk"; screen: string; frameId: string; token: string }
  | {
      type: "screen_done";
      screen: string;
      frameId: string;
      content?: string;
      error?: string | null;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "design_context"; designContext: unknown }
  | { type: "tree"; tree: unknown }
  | {
      type: "quality_warning";
      screen?: string;
      frameId?: string;
      message?: string;
      issues?: unknown;
      score?: number;
    };

export type FrameGenerationEvent =
  | { type: "generation_id"; generationId: string }
  | { type: "frame_start"; frameId: string; screen: string }
  | { type: "frame_reset"; frameId: string; screen: string; reason?: string }
  | { type: "code_chunk"; frameId: string; token: string; screen?: string }
  | {
      type: "frame_done";
      frameId: string;
      screen: string;
      content?: string;
      error?: string | null;
    }
  | { type: "done" }
  | { type: "error"; message: string }
  | {
      type: "quality_warning";
      screen?: string;
      frameId?: string;
      message?: string;
      issues?: unknown;
      score?: number;
    };

export function adaptFrameEvent(
  event: FrameGenerationEvent,
  fallbackScreen: string,
): GenerationEvent {
  switch (event.type) {
    case "frame_start":
      return {
        type: "screen_start",
        screen: event.screen,
        frameId: event.frameId,
      };
    case "frame_reset":
      return {
        type: "screen_reset",
        screen: event.screen,
        frameId: event.frameId,
        reason: event.reason,
      };
    case "code_chunk":
      return {
        type: "code_chunk",
        screen: event.screen ?? fallbackScreen,
        frameId: event.frameId,
        token: event.token,
      };
    case "frame_done":
      return {
        type: "screen_done",
        screen: event.screen,
        frameId: event.frameId,
        content: event.content,
        error: event.error,
      };
    default:
      return event;
  }
}

/** Empty error rows written before a screen finishes are still pending. */
export function isTerminalPersistedScreen(
  screen: Pick<PersistedGenerationScreen, "state" | "content">,
  generationStatus: string,
): boolean {
  if (generationStatus === "RUNNING") {
    return screen.state === "done" && isProbablyCompleteScreen(screen.content);
  }
  return screen.state === "done" || screen.state === "error";
}
