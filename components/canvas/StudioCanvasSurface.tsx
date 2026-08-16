"use client";

import { RefObject } from "react";

import { CanvasErrorBoundary } from "@/components/canvas/CanvasErrorBoundary";
import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import { CanvasScaleProvider } from "@/components/canvas/CanvasScaleContext";
import {
  InfiniteCanvas,
  InfiniteCanvasHandle,
} from "@/components/canvas/InfiniteCanvas";
import { StudioThemeProvider } from "@/components/canvas/StudioThemeContext";
import { CanvasFrameData } from "@/components/canvas/types";
import type { Transform } from "@/components/canvas/hooks/useCanvasTransform";
import type { FrameRect } from "@/components/canvas/types";
import type { ThemeMode } from "@/components/projects/StudioHeader";

interface StudioCanvasSurfaceProps {
  canvasRef: RefObject<InfiniteCanvasHandle | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  frameList: CanvasFrameData[];
  frameRects: FrameRect[];
  activeFrameId: string | null;
  selectedFrameId: string | null;
  isGenerating: boolean;
  themeMode: ThemeMode;
  isDark: boolean;
  canRegenerate: boolean;
  canEditCode: boolean;
  isSpacePressed: () => boolean;
  onFrameExit: () => void;
  onCanvasEmptyPointerDown: () => void;
  onTransformChange: (transform: Transform) => void;
  onSelectFrame: (id: string) => void;
  onActivateFrame: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onAutoFit: (id: string, w: number, h: number) => void;
  onInteractionStart: (id: string) => void;
  onInteractionEnd: (id: string) => void;
  onRegenerate: (id: string) => void;
  onPreviewFailed?: (id: string) => void;
  onDelete: (id: string) => void;
  onEditCode: (id: string) => void;
  onOpenHistory: (id: string) => void;
  onLockedAction: (featureName: string) => void;
}

export function StudioCanvasSurface({
  canvasRef,
  containerRef,
  frameList,
  frameRects,
  activeFrameId,
  selectedFrameId,
  isGenerating,
  themeMode,
  isDark,
  canRegenerate,
  canEditCode,
  isSpacePressed,
  onFrameExit,
  onCanvasEmptyPointerDown,
  onTransformChange,
  onSelectFrame,
  onActivateFrame,
  onMove,
  onResize,
  onAutoFit,
  onInteractionStart,
  onInteractionEnd,
  onRegenerate,
  onPreviewFailed,
  onDelete,
  onEditCode,
  onOpenHistory,
  onLockedAction,
}: StudioCanvasSurfaceProps) {
  return (
    <div className="absolute inset-0 z-40" ref={containerRef}>
      <CanvasErrorBoundary>
        <CanvasScaleProvider>
          <StudioThemeProvider value={{ mode: themeMode, isDark }}>
            <InfiniteCanvas
              ref={canvasRef}
              frames={frameRects}
              frameData={frameList}
              activeFrameId={activeFrameId}
              selectedFrameId={selectedFrameId}
              onFrameExit={onFrameExit}
              onCanvasEmptyPointerDown={onCanvasEmptyPointerDown}
              onTransformChange={onTransformChange}
            >
              {frameList.map((frame) => (
                <CanvasFrame
                  {...frame}
                  key={frame.id}
                  isActive={activeFrameId === frame.id}
                  isSelected={selectedFrameId === frame.id}
                  isSpacePressed={isSpacePressed}
                  onSelect={onSelectFrame}
                  onActivate={onActivateFrame}
                  onMove={onMove}
                  onResize={onResize}
                  onAutoFit={onAutoFit}
                  onInteractionStart={onInteractionStart}
                  onInteractionEnd={onInteractionEnd}
                  handleFrame={onRegenerate}
                  handleDelete={onDelete}
                  handleEditCode={onEditCode}
                  onOpenHistory={onOpenHistory}
                  onPreviewFailed={onPreviewFailed}
                  canRegenerate={canRegenerate}
                  canEditCode={canEditCode}
                  onLockedAction={onLockedAction}
                />
              ))}
            </InfiniteCanvas>
          </StudioThemeProvider>
        </CanvasScaleProvider>
      </CanvasErrorBoundary>

      {frameList.length === 0 && (
        <EmptyCanvasHint isGenerating={isGenerating} />
      )}
    </div>
  );
}

function EmptyCanvasHint({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      {isGenerating ? (
        <div className="flex flex-col items-start gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/45">
            Placing screens
          </p>
          <GhostArtboard />
        </div>
      ) : (
        <p className="text-[13px] text-(--studio-text-secondary)">
          Describe a UI below to start
        </p>
      )}
    </div>
  );
}

function GhostArtboard() {
  return (
    <div className="relative h-44 w-70" aria-hidden="true">
      <div
        className="absolute inset-0 overflow-hidden rounded-xl bg-(--frame-skeleton-bg)"
        style={{ boxShadow: "0 4px 24px var(--frame-shadow)" }}
      >
        <div className="flex h-9 items-center gap-1.5 border-b border-black/15 bg-[#f0f0f0] px-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="space-y-2.5 px-6 py-5">
          {[72, 54, 84, 46].map((width) => (
            <div
              key={width}
              className="h-2 overflow-hidden rounded-sm bg-foreground/6"
              style={{ width: `${width}%` }}
            >
              <div
                className="h-full w-full rounded-sm motion-safe:animate-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
