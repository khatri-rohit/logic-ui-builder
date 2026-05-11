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
import { StudioToolbar } from "@/components/canvas/StudioToolbar";
import {
  CanvasTransformHandle,
  FrameRect,
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
  activeFrameId: string | null;
  onFrameExit: () => void;
  className?: string;
  onTransformChange?: (transform: Transform) => void;
}

export const InfiniteCanvas = forwardRef<
  InfiniteCanvasHandle,
  InfiniteCanvasProps
>(function InfiniteCanvas(
  {
    children,
    frames = [],
    activeFrameId,
    onFrameExit,
    className,
    onTransformChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const [zoomPercent, setZoomPercent] = useState(100);
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
      onTransformChange?.(next);
    },
  );

  const handleContainerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target === containerRef.current) {
        onFrameExit();
      }
    },
    [onFrameExit],
  );

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
    return activeFrameId ? "default" : "grab";
  }, [activeFrameId]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden select-none ${className ?? ""}`}
      style={{ cursor }}
      onPointerDown={handleContainerPointerDown}
    >
      <CanvasGrid transform={transform} />

      <div
        ref={worldRef}
        data-canvas-capture="world"
        className="absolute left-0 top-0 z-10 origin-top-left will-change-transform"
        style={{ transformOrigin: "0 0" }}
      >
        {children}
      </div>

      <StudioToolbar
        zoomPercent={zoomPercent}
        onZoomIn={transformApi.zoomIn}
        onZoomOut={transformApi.zoomOut}
        onFit={() => transformApi.zoomToFit(frames)}
      />
    </div>
  );
});
