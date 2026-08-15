import { RefObject, useCallback, useEffect, useRef } from "react";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";

import type { FrameRect } from "@/components/canvas/types";

export type { FrameRect };

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface CanvasTransformHandle {
  zoomToFit: (frames: FrameRect[], padding?: number) => void;
  zoomToRect: (rect: FrameRect, padding?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setTransform: (transform: Transform) => void;
  getTransform: () => Transform;
  isSpacePressed: () => boolean;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;

function clampZoom(k: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));
}

function getWheelZoomDelta(event: WheelEvent) {
  // Keep Ctrl/Cmd wheel zoom at normal d3 sensitivity.
  const modeFactor = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
  return -event.deltaY * modeFactor;
}

function getWheelPanAxisDelta(delta: number, deltaMode: number) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * 120;
  return delta;
}

function isEventFromActiveIframe(
  event: Event,
  activeFrameId: string | null,
): boolean {
  if (!activeFrameId) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;

  const frame = target.closest(`[data-canvas-frame="${activeFrameId}"]`);
  if (!frame) return false;

  // Iframe owns wheel when the event target is the iframe element itself
  // (parent never sees in-document iframe wheel events; those stay inside).
  return target.tagName === "IFRAME";
}

const GESTURE_END_IDLE_MS = 250;

export function useCanvasTransform(
  containerRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
  activeFrameId: string | null,
  onTransformChange?: (transform: Transform) => void,
  onSpacePressedChange?: (pressed: boolean) => void,
  onGestureStart?: () => void,
  onGestureEnd?: () => void,
): CanvasTransformHandle {
  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    HTMLDivElement,
    unknown
  > | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const onTransformChangeRef = useRef(onTransformChange);
  const onSpacePressedChangeRef = useRef(onSpacePressedChange);
  const onGestureStartRef = useRef(onGestureStart);
  const onGestureEndRef = useRef(onGestureEnd);
  const activeFrameIdRef = useRef(activeFrameId);
  const isSpacePressedRef = useRef(false);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  useEffect(() => {
    onSpacePressedChangeRef.current = onSpacePressedChange;
  }, [onSpacePressedChange]);

  useEffect(() => {
    onGestureStartRef.current = onGestureStart;
  }, [onGestureStart]);

  useEffect(() => {
    onGestureEndRef.current = onGestureEnd;
  }, [onGestureEnd]);

  useEffect(() => {
    activeFrameIdRef.current = activeFrameId;
  }, [activeFrameId]);

  const applyTransform = useCallback(
    (nextTransform: Transform) => {
      transformRef.current = nextTransform;
      const world = worldRef.current;
      if (world) {
        world.style.transform = `translate(${nextTransform.x}px, ${nextTransform.y}px) scale(${nextTransform.k})`;
        world.style.transformOrigin = "0 0";
      }

      onTransformChangeRef.current?.(nextTransform);
    },
    [worldRef],
  );

  useEffect(() => {
    const setSpacePressed = (pressed: boolean) => {
      if (isSpacePressedRef.current === pressed) return;
      isSpacePressedRef.current = pressed;
      onSpacePressedChangeRef.current?.(pressed);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let transformGestureActive = false;
    let gestureEndTimer: ReturnType<typeof setTimeout> | null = null;

    const clearGestureEndTimer = () => {
      if (!gestureEndTimer) return;
      clearTimeout(gestureEndTimer);
      gestureEndTimer = null;
    };

    const zoomBehavior = d3Zoom
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .wheelDelta((event: WheelEvent) => getWheelZoomDelta(event))
      .filter((event: MouseEvent | WheelEvent) => {
        if (event.type === "wheel") {
          const wheelEvent = event as WheelEvent;
          if (!wheelEvent.ctrlKey && !wheelEvent.metaKey) {
            return false;
          }

          if (isEventFromActiveIframe(wheelEvent, activeFrameIdRef.current)) {
            return false;
          }

          wheelEvent.preventDefault();
          return true;
        }

        if (event.type === "mousedown") {
          const mouseEvent = event as MouseEvent;
          // Middle mouse always pans; left pans when Space is held.
          // Left without Space is left to frames (move) or empty-canvas d3 pan.
          if (mouseEvent.button === 1) return true;
          if (mouseEvent.button === 0 && isSpacePressedRef.current) return true;
          if (mouseEvent.button === 0) {
            const target = mouseEvent.target;
            if (target instanceof Element) {
              // Empty canvas / world (not on a frame) → allow d3 pan.
              if (!target.closest("[data-canvas-frame]")) {
                return true;
              }
            }
            return false;
          }
          return false;
        }

        return true;
      })
      .on("start", () => {
        clearGestureEndTimer();
        if (!transformGestureActive) {
          transformGestureActive = true;
          onGestureStartRef.current?.();
        }
      })
      .on("zoom", (event: d3Zoom.D3ZoomEvent<HTMLDivElement, unknown>) => {
        const { x, y, k } = event.transform;
        applyTransform({ x, y, k });
      })
      .on("end", () => {
        clearGestureEndTimer();
        gestureEndTimer = setTimeout(() => {
          gestureEndTimer = null;
          if (!transformGestureActive) return;
          transformGestureActive = false;
          onGestureEndRef.current?.();
        }, GESTURE_END_IDLE_MS);
      });

    zoomBehaviorRef.current = zoomBehavior;

    const selection = d3Selection.select(container);
    selection.call(zoomBehavior as never);
    selection.on("dblclick.zoom", null);

    const markWheelGesture = () => {
      clearGestureEndTimer();
      if (!transformGestureActive) {
        transformGestureActive = true;
        onGestureStartRef.current?.();
      }
      gestureEndTimer = setTimeout(() => {
        gestureEndTimer = null;
        if (!transformGestureActive) return;
        transformGestureActive = false;
        onGestureEndRef.current?.();
      }, GESTURE_END_IDLE_MS);
    };

    const handleWheelPan = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      // Active iframe content owns wheel; parent rarely sees those events.
      // If we do see a wheel whose target is the iframe element, skip pan.
      if (isEventFromActiveIframe(event, activeFrameIdRef.current)) {
        return;
      }

      event.preventDefault();
      markWheelGesture();

      const current = transformRef.current;
      const panDeltaY = getWheelPanAxisDelta(event.deltaY, event.deltaMode);
      const panDeltaX = getWheelPanAxisDelta(event.deltaX, event.deltaMode);
      const next = {
        x: current.x - panDeltaX,
        y: current.y - panDeltaY,
        k: current.k,
      };

      const targetTransform = d3Zoom.zoomIdentity
        .translate(next.x, next.y)
        .scale(next.k);

      selection.call(zoomBehavior.transform as never, targetTransform);
    };

    const preventNativeZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (isEventFromActiveIframe(event, activeFrameIdRef.current)) return;
        event.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheelPan, {
      passive: false,
    });
    container.addEventListener("wheel", preventNativeZoom, {
      passive: false,
    });

    return () => {
      selection.on(".zoom", null);
      container.removeEventListener("wheel", handleWheelPan);
      container.removeEventListener("wheel", preventNativeZoom);
      if (gestureEndTimer) {
        clearTimeout(gestureEndTimer);
      }
      if (transformGestureActive) {
        onGestureEndRef.current?.();
      }
    };
  }, [applyTransform, containerRef]);

  const setTransform = useCallback(
    (nextTransform: Transform) => {
      const container = containerRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (!container || !zoomBehavior) return;

      const clamped = {
        x: nextTransform.x,
        y: nextTransform.y,
        k: clampZoom(nextTransform.k),
      };

      const targetTransform = d3Zoom.zoomIdentity
        .translate(clamped.x, clamped.y)
        .scale(clamped.k);

      d3Selection
        .select(container)
        .call(zoomBehavior.transform as never, targetTransform);
    },
    [containerRef],
  );

  const zoomToRect = useCallback(
    (rect: FrameRect, padding = 60) => {
      const container = containerRef.current;
      if (!container || rect.w <= 0 || rect.h <= 0) return;

      const vw = container.clientWidth;
      const vh = container.clientHeight;
      if (vw <= 0 || vh <= 0) return;

      const scaleX = (vw - padding * 2) / rect.w;
      const scaleY = (vh - padding * 2) / rect.h;
      const k = clampZoom(Math.min(scaleX, scaleY));

      const tx = vw / 2 - (rect.x + rect.w / 2) * k;
      const ty = vh / 2 - (rect.y + rect.h / 2) * k;

      setTransform({ x: tx, y: ty, k });
    },
    [containerRef, setTransform],
  );

  const zoomToFit = useCallback(
    (frames: FrameRect[], padding = 60) => {
      if (frames.length === 0) return;

      const minX = Math.min(...frames.map((frame) => frame.x));
      const minY = Math.min(...frames.map((frame) => frame.y));
      const maxX = Math.max(...frames.map((frame) => frame.x + frame.w));
      const maxY = Math.max(...frames.map((frame) => frame.y + frame.h));

      zoomToRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, padding);
    },
    [zoomToRect],
  );

  const zoomIn = useCallback(() => {
    const container = containerRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!container || !zoomBehavior) return;

    d3Selection.select(container).call(zoomBehavior.scaleBy as never, 1.2);
  }, [containerRef]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!container || !zoomBehavior) return;

    d3Selection.select(container).call(zoomBehavior.scaleBy as never, 1 / 1.2);
  }, [containerRef]);

  const resetZoom = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, [setTransform]);

  const getTransform = useCallback(() => transformRef.current, []);
  const isSpacePressed = useCallback(() => isSpacePressedRef.current, []);

  return {
    zoomToFit,
    zoomToRect,
    zoomIn,
    zoomOut,
    resetZoom,
    setTransform,
    getTransform,
    isSpacePressed,
  };
}
