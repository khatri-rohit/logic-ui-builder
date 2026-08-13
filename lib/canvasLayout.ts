import { GenerationPlatform } from "./types";

const H_GAP = 100; // gap between screens in same generation
/** Vertical gap between generation rows. */
const ROW_GAP = 100;

export const WEB_VIEWPORT_STANDARDS = {
  min: 1024,
  standard: 1280,
  max: 1440,
  wide: 1920,
  form: 640,
} as const;

export interface ExistingFrameBounds {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getViewportLabel(
  platform: GenerationPlatform,
  width: number,
): string {
  if (platform === "mobile") {
    return `mobile ${width}px viewport artboard, touch-first`;
  }
  return `web ${width}px viewport artboard, design for that width`;
}

/** Bottom edge of a frame rect. */
export function frameBottom(frame: ExistingFrameBounds): number {
  return frame.y + frame.h;
}

/**
 * Merge frame bounds from multiple sources (DB screens + live canvas).
 * Same id → keep the larger height and the more recent geometry preference
 * (later sources win for x/y/w; h is max so auto-fit is never lost).
 */
export function mergeExistingFrameBounds(
  ...sources: ExistingFrameBounds[][]
): ExistingFrameBounds[] {
  const byId = new Map<string, ExistingFrameBounds>();
  const anonymous: ExistingFrameBounds[] = [];

  for (const source of sources) {
    for (const frame of source) {
      if (!frame.id) {
        anonymous.push({ ...frame });
        continue;
      }
      const prev = byId.get(frame.id);
      if (!prev) {
        byId.set(frame.id, { ...frame });
        continue;
      }
      byId.set(frame.id, {
        id: frame.id,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        // Prefer the taller height so auto-fitted canvas size wins over stale DB h
        h: Math.max(prev.h, frame.h),
      });
    }
  }

  return [...byId.values(), ...anonymous];
}

/**
 * Collect bounds from generation screen payloads, optionally excluding one generation
 * (e.g. the in-progress reservation that has no real layout yet).
 */
export function collectBoundsFromGenerations(
  generations: Array<{
    id?: string;
    screens: Array<{ id?: string; x: number; y: number; w: number; h: number }>;
  }>,
  excludeGenerationId?: string | null,
): ExistingFrameBounds[] {
  const bounds: ExistingFrameBounds[] = [];
  for (const gen of generations) {
    if (excludeGenerationId && gen.id && gen.id === excludeGenerationId) {
      continue;
    }
    for (const s of gen.screens) {
      if (
        !Number.isFinite(s.x) ||
        !Number.isFinite(s.y) ||
        !Number.isFinite(s.w) ||
        !Number.isFinite(s.h) ||
        s.w <= 0 ||
        s.h <= 0
      ) {
        continue;
      }
      bounds.push({
        id: s.id,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
      });
    }
  }
  return bounds;
}

export function getGenerationLayout(
  existingFrames: ExistingFrameBounds[],
  screens: Array<{ name: string; w: number; h: number }>,
): { x: number; y: number }[] {
  const lowestEdge =
    existingFrames.length === 0
      ? 0
      : Math.max(...existingFrames.map((frame) => frameBottom(frame)));
  const startY = lowestEdge + (existingFrames.length > 0 ? ROW_GAP : 0);

  // New generation always starts a fresh left-aligned row below existing frames.
  const startX = 0;
  let currentX = 0;

  return screens.map((screen) => {
    const x = startX + currentX;
    currentX += screen.w + H_GAP;
    return { x, y: startY };
  });
}

export function getRegenerationClonePosition(
  existingFrames: ExistingFrameBounds[],
  sourceFrame: ExistingFrameBounds,
): { x: number; y: number } {
  const ROW_EPSILON = 1;
  const sameRowFrames = existingFrames.filter(
    (frame) => Math.abs(frame.y - sourceFrame.y) <= ROW_EPSILON,
  );

  const rowRightEdge = Math.max(
    sourceFrame.x + sourceFrame.w,
    ...sameRowFrames.map((frame) => frame.x + frame.w),
  );

  return {
    x: rowRightEdge + H_GAP,
    y: sourceFrame.y,
  };
}

export function getInitialDimensions(screenType: string): {
  w: number;
  h: number;
} {
  return getInitialDimensionsForPlatform(screenType, "web");
}

export function getInitialDimensionsForPlatform(
  screenType: string,
  platform: GenerationPlatform,
): {
  w: number;
  h: number;
} {
  const type = screenType.toLowerCase();

  if (platform === "mobile") {
    // Phone-scale only — tablet widths conflict with phone chrome and MAX_MOBILE_W.
    if (type.includes("modal") || type.includes("dialog")) {
      return { w: 360, h: 640 };
    }
    return { w: 390, h: 844 };
  }

  if (type.includes("landing") || type.includes("home") || type.includes("hero"))
    return { w: WEB_VIEWPORT_STANDARDS.standard, h: 800 };

  if (type.includes("dashboard") || type.includes("admin"))
    return { w: WEB_VIEWPORT_STANDARDS.standard, h: 900 };

  if (
    type.includes("settings") ||
    type.includes("profile") ||
    type.includes("account")
  )
    return { w: WEB_VIEWPORT_STANDARDS.min, h: 700 };

  if (type.includes("modal") || type.includes("dialog"))
    return { w: 560, h: 480 };

  if (type.includes("article") || type.includes("blog") || type.includes("post"))
    return { w: 768, h: 900 };

  if (
    type.includes("pricing") ||
    type.includes("features") ||
    type.includes("about")
  )
    return { w: WEB_VIEWPORT_STANDARDS.standard, h: 700 };

  if (type.includes("contact") || type.includes("faq") || type.includes("terms"))
    return { w: WEB_VIEWPORT_STANDARDS.min, h: 600 };

  if (
    type.includes("login") ||
    type.includes("signin") ||
    type.includes("signup") ||
    type.includes("register")
  )
    return { w: WEB_VIEWPORT_STANDARDS.form, h: 600 };

  return { w: WEB_VIEWPORT_STANDARDS.min, h: 700 };
}
