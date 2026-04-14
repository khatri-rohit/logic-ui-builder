import { GenerationPlatform } from "@/lib/types";

export type FrameState =
  | "skeleton"
  | "streaming"
  | "compiling"
  | "done"
  | "error";

export interface CanvasCameraSnapshot {
  x: number;
  y: number;
  k: number;
}

export interface CanvasFrameSnapshot {
  id: string;
  screenName: string;
  platform: GenerationPlatform;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  editedContent: string | null;
  state: FrameState;
  thumbnail: string | null;
  generationId: string;
  error: string | null;
}

export interface CanvasSnapshotV1 {
  version: 1;
  camera: CanvasCameraSnapshot;
  frames: CanvasFrameSnapshot[];
  activeFrameId: string | null;
  selectedFrameId: string | null;
  savedAt: string;
}

const FRAME_STATES = new Set<FrameState>([
  "skeleton",
  "streaming",
  "compiling",
  "done",
  "error",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isFrameState(value: unknown): value is FrameState {
  return typeof value === "string" && FRAME_STATES.has(value as FrameState);
}

function isGenerationPlatform(value: unknown): value is GenerationPlatform {
  return value === "web" || value === "mobile";
}

function isCameraSnapshot(value: unknown): value is CanvasCameraSnapshot {
  if (!isObject(value)) return false;
  return isNumber(value.x) && isNumber(value.y) && isPositiveNumber(value.k);
}

function isFrameSnapshot(value: unknown): value is CanvasFrameSnapshot {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.screenName === "string" &&
    isGenerationPlatform(value.platform) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isPositiveNumber(value.w) &&
    isPositiveNumber(value.h) &&
    typeof value.content === "string" &&
    isStringOrNull(value.editedContent) &&
    isFrameState(value.state) &&
    isStringOrNull(value.thumbnail) &&
    typeof value.generationId === "string" &&
    isStringOrNull(value.error)
  );
}

export function isCanvasSnapshotV1(value: unknown): value is CanvasSnapshotV1 {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (!isCameraSnapshot(value.camera)) return false;
  if (!Array.isArray(value.frames) || !value.frames.every(isFrameSnapshot)) {
    return false;
  }

  const activeFrameIdValid =
    typeof value.activeFrameId === "string" || value.activeFrameId === null;
  const selectedFrameIdValid =
    typeof value.selectedFrameId === "string" || value.selectedFrameId === null;

  return (
    activeFrameIdValid &&
    selectedFrameIdValid &&
    typeof value.savedAt === "string"
  );
}
