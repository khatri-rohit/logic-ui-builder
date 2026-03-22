/* eslint-disable @typescript-eslint/no-unused-vars */
import { Editor } from "tldraw";

const FRAME_W = 200;
const FRAME_H = 380;
const H_GAP = 1500; // gap between screens in same generation
const V_GAP = 120; // gap between generations (vertical breathing room)

export function getGenerationLayout(
  editor: Editor,
  screenCount: number,
): { x: number; y: number }[] {
  // Step 1 — find the bottom of ALL existing content on canvas
  const pageBounds = editor.getCurrentPageBounds();
  //                 ↑ tldraw built-in — returns bounding box of every shape
  //                   returns null if canvas is empty

  const startY = pageBounds
    ? pageBounds.maxY + V_GAP // below everything existing
    : 0; // first generation — start at origin

  // Step 2 — center the whole group horizontally
  // total width = N frames + (N-1) gaps between them
  const totalGroupW = screenCount * FRAME_W + (screenCount - 1) * H_GAP;
  const startX = (pageBounds?.midX ?? 0) - totalGroupW / 2;
  //              ↑ center new generation under the midpoint of existing content
  //                falls back to 0 if nothing exists yet

  // Step 3 — compute x,y for each individual screen
  return Array.from({ length: screenCount }, (_, i) => ({
    x: startX + i * (FRAME_W + H_GAP),
    y: startY,
  }));
}
