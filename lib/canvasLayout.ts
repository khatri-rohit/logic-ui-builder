import { Editor } from "tldraw";

const H_GAP = 100; // gap between screens in same generation
const V_GAP = 120; // gap between generations (vertical breathing room)

export function getGenerationLayout(
  editor: Editor,
  screens: Array<{ name: string; w: number; h: number }>, // pass dims in
): { x: number; y: number }[] {
  const pageBounds = editor.getCurrentPageBounds();
  const startY = pageBounds ? pageBounds.maxY + V_GAP : 0;

  // Position each screen with its actual width
  let currentX = 0;
  const totalW = screens.reduce(
    (sum, s, i) => sum + s.w + (i < screens.length - 1 ? H_GAP : 0),
    0,
  );
  const startX = (pageBounds?.midX ?? 0) - totalW / 2;

  return screens.map((screen) => {
    const x = startX + currentX;
    currentX += screen.w + H_GAP;
    return { x, y: startY };
  });
}

export function getInitialDimensions(screenType: string): {
  w: number;
  h: number;
} {
  const type = screenType.toLowerCase();

  if (
    type.includes("landing") ||
    type.includes("home") ||
    type.includes("hero")
  )
    return { w: 1200, h: 800 }; // wide landing page

  if (type.includes("dashboard") || type.includes("admin"))
    return { w: 1280, h: 900 }; // wide dashboard

  if (type.includes("mobile") || type.includes("screen"))
    return { w: 390, h: 844 }; // iPhone 14 dimensions

  if (type.includes("tablet")) return { w: 768, h: 1024 };

  if (type.includes("modal") || type.includes("dialog"))
    return { w: 480, h: 400 };

  // Default — medium web page
  return { w: 900, h: 700 };
}
