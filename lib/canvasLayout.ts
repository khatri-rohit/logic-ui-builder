import { GenerationPlatform } from "./types";

const H_GAP = 100; // gap between screens in same generation

export const WEB_VIEWPORT_STANDARDS = {
  min: 1024,
  standard: 1280,
  max: 1440,
  wide: 1920,
  form: 640,
} as const;

interface ExistingFrameBounds {
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

export function getGenerationLayout(
  existingFrames: ExistingFrameBounds[],
  screens: Array<{ name: string; w: number; h: number }>, // pass dims in
): { x: number; y: number }[] {
  const lowestEdge =
    existingFrames.length === 0
      ? 0
      : Math.max(...existingFrames.map((frame) => frame.y + frame.h));
  const startY = lowestEdge + (existingFrames.length > 0 ? H_GAP : 0);

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
