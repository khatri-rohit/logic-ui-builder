import { RefObject, useCallback, useEffect, useRef } from "react";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasTransformHandle {
  zoomToFit: (frames: FrameRect[], padding?: number) => void;
  zoomToRect: (rect: FrameRect, padding?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setTransform: (transform: Transform) => void;
  getTransform: () => Transform;
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

function getWheelPanDelta(event: WheelEvent) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * 120;
  return event.deltaY;
}

export function useCanvasTransform(
  containerRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
  _activeFrameId: string | null,
  onTransformChange?: (transform: Transform) => void,
): CanvasTransformHandle {
  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    HTMLDivElement,
    unknown
  > | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const onTransformChangeRef = useRef(onTransformChange);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

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
    const container = containerRef.current;
    if (!container) return;

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

          wheelEvent.preventDefault();
          return true;
        }

        if (event.type === "mousedown") {
          return event.button === 0 || event.button === 1;
        }

        return true;
      })
      .on("zoom", (event: d3Zoom.D3ZoomEvent<HTMLDivElement, unknown>) => {
        const { x, y, k } = event.transform;
        applyTransform({ x, y, k });
      });

    zoomBehaviorRef.current = zoomBehavior;

    const selection = d3Selection.select(container);
    selection.call(zoomBehavior as never);
    selection.on("dblclick.zoom", null);

    const handleWheelPan = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      event.preventDefault();

      const current = transformRef.current;
      const panDeltaY = getWheelPanDelta(event);
      const next = {
        x: current.x,
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

  return {
    zoomToFit,
    zoomToRect,
    zoomIn,
    zoomOut,
    resetZoom,
    setTransform,
    getTransform,
  };
}
