"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { CanvasGrid } from "@/components/canvas/CanvasGrid";
import { useCanvasScaleStore } from "@/components/canvas/CanvasScaleContext";
import { StudioToolbar } from "@/components/canvas/StudioToolbar";
import { CanvasFrameData, FrameRect } from "@/components/canvas/types";
import {
  CanvasTransformHandle,
  Transform,
  useCanvasTransform,
} from "@/components/canvas/hooks/useCanvasTransform";

export interface InfiniteCanvasHandle extends CanvasTransformHandle {
  getPointerMode: () => "canvas" | "frame-active";
  exitFrame: () => void;
}

interface InfiniteCanvasProps {
  children?: React.ReactNode;
  frames?: FrameRect[];
  frameData?: CanvasFrameData[];
  activeFrameId: string | null;
  selectedFrameId?: string | null;
  /** Exit active preview only (keep selection). */
  onFrameExit: () => void;
  /** Empty canvas click: exit active if any, then deselect. */
  onCanvasEmptyPointerDown?: () => void;
  className?: string;
  /** Debounced camera persist / external listeners — not used for per-frame scale. */
  onTransformChange?: (transform: Transform) => void;
}

function isEmptyCanvasTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-canvas-frame]")) return false;
  if (target.closest("[data-canvas-toolbar]")) return false;
  return true;
}

export const InfiniteCanvas = forwardRef<
  InfiniteCanvasHandle,
  InfiniteCanvasProps
>(function InfiniteCanvas(
  {
    children,
    frames = [],
    frameData,
    activeFrameId,
    selectedFrameId,
    onFrameExit,
    onCanvasEmptyPointerDown,
    className,
    onTransformChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const scaleStore = useCanvasScaleStore();
  const onTransformChangeRef = useRef(onTransformChange);
  onTransformChangeRef.current = onTransformChange;

  const [zoomPercent, setZoomPercent] = useState(100);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [transform, setTransformState] = useState<Transform>({
    x: 0,
    y: 0,
    k: 1,
  });

  const transformApi = useCanvasTransform(
    containerRef,
    worldRef,
    activeFrameId,
    (next) => {
      setTransformState(next);
      setZoomPercent(Math.round(next.k * 100));
      scaleStore.setScale(next.k);
      onTransformChangeRef.current?.(next);
    },
    setIsSpacePressed,
  );

  const handleContainerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (isSpacePressed) return;
      if (!isEmptyCanvasTarget(event.target)) return;

      if (onCanvasEmptyPointerDown) {
        onCanvasEmptyPointerDown();
      } else {
        onFrameExit();
      }
    },
    [isSpacePressed, onCanvasEmptyPointerDown, onFrameExit],
  );

  const selectedFrameRect = useMemo(() => {
    if (!selectedFrameId || !frameData) return null;
    const found = frameData.find((f) => f.id === selectedFrameId);
    if (!found) return null;
    return { x: found.x, y: found.y, w: found.w, h: found.h };
  }, [frameData, selectedFrameId]);

  const handleFitSelected = useCallback(() => {
    if (selectedFrameRect) {
      transformApi.zoomToRect(selectedFrameRect, 40);
    }
  }, [selectedFrameRect, transformApi]);

  useImperativeHandle(
    ref,
    () => ({
      ...transformApi,
      getPointerMode: () => (activeFrameId ? "frame-active" : "canvas"),
      exitFrame: onFrameExit,
    }),
    [activeFrameId, onFrameExit, transformApi],
  );

  const cursor = useMemo(() => {
    if (isSpacePressed) return "grab";
    return activeFrameId ? "default" : "grab";
  }, [activeFrameId, isSpacePressed]);

  return (
    <div
      ref={containerRef}
      data-canvas-empty="true"
      className={`relative h-full w-full overflow-hidden select-none ${className ?? ""}`}
      style={{ cursor }}
      onPointerDown={handleContainerPointerDown}
    >
      <CanvasGrid transform={transform} />

      <div
        ref={worldRef}
        data-canvas-capture="world"
        data-canvas-empty="true"
        className="absolute left-0 top-0 z-10 origin-top-left will-change-transform"
        style={{ transformOrigin: "0 0" }}
      >
        {children}
      </div>

      <div data-canvas-toolbar="true">
        <StudioToolbar
          zoomPercent={zoomPercent}
          onZoomIn={transformApi.zoomIn}
          onZoomOut={transformApi.zoomOut}
          onFit={() => transformApi.zoomToFit(frames)}
          onFitSelected={handleFitSelected}
          hasSelectedFrame={!!selectedFrameId}
        />
      </div>
    </div>
  );
});
