import { GenerationPlatform } from "@/lib/types";

export type FrameState = "skeleton" | "streaming" | "done" | "error";

export interface CanvasCameraSnapshot {
  x: number;
  y: number;
  k: number;
}

export interface CanvasFrameSnapshot {
  id: string;
  generationId: string;
  state: FrameState;
  x: number;
  y: number;
  w: number;
  h: number;
  screenName: string; //
  platform: GenerationPlatform; //
  content: string; //
  editedContent: string | null; //
  error: string | null;
}

export interface PersistedGenerationScreen {
  id: string;
  state: FrameState;
  x: number;
  y: number;
  w: number;
  h: number;
  screenName: string;
  content: string;
  editedContent: string | null;
  error: string | null;
}

export interface GeneratedFrame {
  generationId: string;
  screenName: string;
  content: string;
  platform: GenerationPlatform;
  editedContent: string | null;
}

export interface CanvasStateMetadataV1 {
  version: 1;
  camera: CanvasCameraSnapshot;
  activeFrameId: string | null;
  selectedFrameId: string | null;
  selectedGenerationId: string | null;
  savedAt: string;
}

export interface CanvasSnapshotV1 extends CanvasStateMetadataV1 {
  frames: CanvasFrameSnapshot[];
}

const FRAME_STATES = new Set<FrameState>([
  "skeleton",
  "streaming",
  "done",
  "error",
]);

export function coerceFrameState(value: unknown): FrameState | null {
  if (value === "compiling") return "streaming";
  if (
    typeof value === "string" &&
    FRAME_STATES.has(value as FrameState)
  ) {
    return value as FrameState;
  }
  return null;
}

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
  return coerceFrameState(value) !== null;
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
    typeof value.generationId === "string" &&
    isGenerationPlatform(value.platform) &&
    isStringOrNull(value.error)
  );
}

export function isPersistedGenerationScreen(
  value: unknown,
): value is PersistedGenerationScreen {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.screenName === "string" &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isPositiveNumber(value.w) &&
    isPositiveNumber(value.h) &&
    typeof value.content === "string" &&
    isStringOrNull(value.editedContent) &&
    isFrameState(value.state) &&
    isStringOrNull(value.error)
  );
}

export function isCanvasStateMetadataV1(
  value: unknown,
): value is CanvasStateMetadataV1 {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (!isCameraSnapshot(value.camera)) return false;

  const activeFrameIdValid =
    typeof value.activeFrameId === "string" || value.activeFrameId === null;
  const selectedFrameIdValid =
    typeof value.selectedFrameId === "string" || value.selectedFrameId === null;
  const selectedGenerationIdValid =
    typeof value.selectedGenerationId === "string" ||
    value.selectedGenerationId === null ||
    value.selectedGenerationId === undefined;

  return (
    activeFrameIdValid &&
    selectedFrameIdValid &&
    selectedGenerationIdValid &&
    typeof value.savedAt === "string"
  );
}

export function isCanvasSnapshotV1(value: unknown): value is CanvasSnapshotV1 {
  if (!isCanvasStateMetadataV1(value)) return false;

  const maybeFrames = (value as unknown as { frames?: unknown }).frames;

  if (!Array.isArray(maybeFrames)) {
    return false;
  }

  return maybeFrames.every(isFrameSnapshot);
}

export function toCanvasStateMetadata(
  snapshot: CanvasSnapshotV1,
): CanvasStateMetadataV1 {
  return {
    version: snapshot.version,
    camera: snapshot.camera,
    activeFrameId: snapshot.activeFrameId,
    selectedFrameId: snapshot.selectedFrameId,
    selectedGenerationId: snapshot.selectedGenerationId,
    savedAt: snapshot.savedAt,
  };
}
