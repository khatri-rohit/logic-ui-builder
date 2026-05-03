# components/canvas/ - Infinite Canvas

tldraw integration for design workspace.

## FILES

| File | Purpose |
|------|---------|
| `canvas.tsx` | Main canvas component |
| `canvas-layout.ts` | Artboard positioning |
| `hooks/useCanvasState.ts` | Zustand store |

## STRUCTURE

- `components/canvas/` - Main canvas
- `components/canvas/hooks/` - Canvas state hooks
- `lib/canvas-state.ts` - Canvas state utilities

## NOTES

- Uses tldraw for infinite canvas
- Artboards are draggable phone frames
- Sandpack previews render inside artboards
- d3-zoom for pan/zoom controls