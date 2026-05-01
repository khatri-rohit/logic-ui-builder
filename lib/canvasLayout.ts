import { GenerationPlatform } from "./types";

const H_GAP = 100; // gap between screens in same generation

interface ExistingFrameBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getGenerationLayout(
  existingFrames: ExistingFrameBounds[],
  screens: Array<{ name: string; w: number; h: number }>, // pass dims in
): { x: number; y: number }[] {
  const startY =
    existingFrames.length === 0
      ? 0
      : Math.min(...existingFrames.map((frame) => frame.y));

  // Position each screen with its actual width
  let currentX = 0;

  const startX =
    existingFrames.length === 0
      ? 0
      : Math.max(...existingFrames.map((frame) => frame.x + frame.w)) + H_GAP;

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
  const sameRowFrames = existingFrames.filter(
    (frame) => frame.y === sourceFrame.y,
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
    if (type.includes("tablet")) return { w: 768, h: 1024 };
    if (type.includes("modal") || type.includes("dialog"))
      return { w: 360, h: 640 };
    return { w: 390, h: 844 };
  }

  if (
    type.includes("landing") ||
    type.includes("home") ||
    type.includes("hero")
  )
    return { w: 1200, h: 800 }; // wide landing page

  if (type.includes("dashboard") || type.includes("admin"))
    return { w: 1280, h: 900 }; // wide dashboard

  if (type.includes("tablet")) return { w: 768, h: 1024 };

  if (type.includes("modal") || type.includes("dialog"))
    return { w: 480, h: 400 };

  // Default — medium web page with stable desktop baseline width
  return { w: 960, h: 700 };
}
