"use client";

import { RefObject } from "react";
import { Code2, Sparkles } from "lucide-react";

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
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-[min(420px,calc(100%-2rem))] rounded-lg border border-border bg-card/95 p-6 text-center shadow-2xl shadow-black/40">
            <div
              className="mx-auto flex size-10 items-center justify-center rounded-md border border-border bg-foreground/5"
              aria-hidden="true"
            >
              {isGenerating ? (
                <Sparkles className="size-5 animate-spin text-foreground/80" />
              ) : (
                <Code2 className="size-5 text-foreground/70" />
              )}
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {isGenerating ? "Preparing screens" : "No screens on this canvas"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/55">
              {isGenerating
                ? "LOGIC is extracting the app spec and will place preview screens here shortly."
                : "Use the prompt bar below to generate a new UI, or restore a project from history."}
            </p>
            {!isGenerating && (
              <p className="sr-only">
                Type a description of your desired UI in the prompt bar below
                and press Enter to generate screens.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
