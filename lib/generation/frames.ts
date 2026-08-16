import type { CanvasFrameData } from "@/components/canvas/types";
import type { FrameState } from "@/lib/canvas-state";
import { getInitialDimensionsForPlatform } from "@/lib/canvasLayout";
import { isProbablyCompleteScreen } from "@/lib/sandboxFallbackScreen";
import type { GenerationPlatform } from "@/lib/types";

export function recoverStalledFrames(frames: Map<string, CanvasFrameData>): {
  frames: Map<string, CanvasFrameData>;
  changed: boolean;
} {
  let changed = false;
  const next = new Map(frames);

  for (const [frameId, frame] of frames) {
    if (frame.state !== "skeleton" && frame.state !== "streaming") continue;
    changed = true;
    const complete = isProbablyCompleteScreen(frame.content);
    next.set(frameId, {
      ...frame,
      state: complete ? "done" : "error",
      error: complete ? null : "Generation did not finish.",
    });
  }

  return { frames: next, changed };
}

export function createFrame(args: {
  id: string;
  screenName: string;
  platform: GenerationPlatform;
  generationId: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  state?: FrameState;
  content?: string;
  error?: string | null;
}): CanvasFrameData {
  const dims = getInitialDimensionsForPlatform(args.screenName, args.platform);
  return {
    id: args.id,
    screenName: args.screenName,
    platform: args.platform,
    x: args.x ?? 100,
    y: args.y ?? 100,
    w: args.w ?? dims.w,
    h: args.h ?? dims.h,
    content: args.content ?? "",
    editedContent: null,
    state: args.state ?? "streaming",
    generationId: args.generationId,
    error: args.error ?? null,
  };
}
