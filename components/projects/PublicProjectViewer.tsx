"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import { CanvasErrorBoundary } from "@/components/canvas/CanvasErrorBoundary";
import {
  InfiniteCanvas,
  InfiniteCanvasHandle,
} from "@/components/canvas/InfiniteCanvas";
import { StudioThemeProvider } from "@/components/canvas/StudioThemeContext";
import { StudioShell } from "@/components/canvas/StudioShell";
import { Transform } from "@/components/canvas/hooks/useCanvasTransform";
import { useSharedProjectQuery } from "@/lib/projects/queries";
import { CanvasFrameData } from "@/components/canvas/types";
import { CanvasSnapshotV1 } from "@/lib/canvas-state";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

interface PublicProjectViewerProps {
  token: string;
}

function toFrameDataArray(
  snapshot: CanvasSnapshotV1 | null,
): CanvasFrameData[] {
  if (!snapshot) return [];
  return snapshot.frames.map((frame) => ({
    ...frame,
    platform: frame.platform ?? "web",
  }));
}

export default function PublicProjectViewer({
  token,
}: PublicProjectViewerProps) {
  const { data: project, isLoading, isError, error } = useSharedProjectQuery(token);

  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const [canvasTransform, setCanvasTransform] = useState<Transform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const platform = project?.platform ?? "web";

  const isDark = true; // Public viewer defaults to dark theme

  const themeVariables = [
    "[--radius:2px] [--background:#111111] [--foreground:#e2e2e2]",
    "[--card:#1a1a1a] [--card-foreground:#e2e2e2] [--popover:#1a1a1a] [--popover-foreground:#f9f9f9]",
    "[--primary:#ffffff] [--primary-foreground:#000000] [--secondary:#1a1a1a] [--secondary-foreground:#f1f1f1]",
    "[--muted:#1a1a1a] [--muted-foreground:#777777] [--accent:#222222] [--accent-foreground:#f9f9f9]",
    "[--destructive:#ba1a1a] [--border:#222222] [--input:#333333] [--ring:#777777]",
    "[--canvas-background:#111111] [--canvas-dot:rgba(255,255,255,0.16)]",
    "[--frame-error-bg:#0f0f0f] [--frame-skeleton-bg:#1a1a1a]",
    "[--frame-border-default:rgba(255,255,255,0.10)] [--frame-border-selected:rgba(255,255,255,0.28)]",
    "[--frame-shadow:rgba(0,0,0,0.55)] [--status-bar-bg:black] [--status-bar-text:white]",
  ];

  const frameList = useMemo(() => {
    if (!project) return [];
    const snapshot = project.canvasState
      ? ({ ...project.canvasState, frames: project.frames } as CanvasSnapshotV1)
      : null;
    return toFrameDataArray(snapshot);
  }, [project]);

  useEffect(() => {
    if (frameList.length === 0) return;

    if (project?.canvasState) {
      const camera = project.canvasState.camera;
      requestAnimationFrame(() => {
        canvasRef.current?.setTransform(camera);
        setCanvasTransform(camera);
      });
    } else {
      requestAnimationFrame(() => {
        canvasRef.current?.zoomToFit(
          frameList.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })),
        );
      });
    }
  }, [project?.canvasState, frameList]);

  const handleTransformChange = useCallback((nextTransform: Transform) => {
    setCanvasTransform(nextTransform);
  }, []);

  const handleMoveFrame = useCallback(() => {
    // No-op: read-only
  }, []);

  const handleResizeFrame = useCallback(() => {
    // No-op: read-only
  }, []);

  const handleFrameAction = useCallback(() => {
    // No-op: read-only
  }, []);

  const handleDeleteFrame = useCallback(() => {
    // No-op: read-only
  }, []);

  const handleEditCode = useCallback(() => {
    // No-op: read-only
  }, []);

  if (isLoading) {
    return (
      <StudioShell className={cn("dark", ...themeVariables)}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Loading shared project...
          </div>
        </div>
      </StudioShell>
    );
  }

  if (isError || !project) {
    const message =
      error instanceof Error
        ? error.message
        : "This project is not publicly shared or does not exist.";

    return (
      <StudioShell className={cn("dark", ...themeVariables)}>
        <div className="flex h-full w-full items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-md border border-border bg-card p-6 text-center">
            <h1 className="text-sm font-medium text-foreground">
              Unable to load shared project
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell className={cn("dark", ...themeVariables)}>
      <div className="absolute inset-0 z-40">
        <CanvasErrorBoundary>
          <StudioThemeProvider value={{ mode: "dark", isDark }}>
            <InfiniteCanvas
              ref={canvasRef}
              frames={frameList.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }))}
              activeFrameId={activeFrameId}
              onFrameExit={() => setActiveFrameId(null)}
              onTransformChange={handleTransformChange}
            >
              {frameList.map((frame) => (
                <CanvasFrame
                  {...frame}
                  key={frame.id}
                  scale={canvasTransform.k}
                  isActive={activeFrameId === frame.id}
                  isSelected={selectedFrameId === frame.id}
                  readOnly
                  onSelect={(id) => {
                    setSelectedFrameId(id);
                  }}
                  onActivate={(id) => {
                    setSelectedFrameId(id);
                    setActiveFrameId(id);
                  }}
                  onMove={handleMoveFrame}
                  onResize={handleResizeFrame}
                  handleFrame={handleFrameAction}
                  handleDelete={handleDeleteFrame}
                  handleEditCode={handleEditCode}
                />
              ))}
            </InfiniteCanvas>
          </StudioThemeProvider>
        </CanvasErrorBoundary>
      </div>

      {/* Minimal read-only header */}
      <div className="pointer-events-auto absolute left-5 top-5 z-50">
        <div className="flex items-center gap-2 rounded-md bg-card/80 px-3 py-2 backdrop-blur-sm border border-border">
          <Eye className="size-4 text-muted-foreground" />
          <div className="min-w-0 max-w-48">
            <h1 className="truncate text-sm font-medium text-foreground">
              {project.title || "Untitled Project"}
            </h1>
          </div>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            View only
          </span>
        </div>
      </div>
    </StudioShell>
  );
}
