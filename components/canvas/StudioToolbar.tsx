"use client";

import {
  Focus,
  Grid3X3,
  Minus,
  Plus,
  SquareDashed,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";

interface StudioToolbarProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onFitSelected?: () => void;
  hasSelectedFrame?: boolean;
}

export function StudioToolbar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
  onFitSelected,
  hasSelectedFrame = false,
}: StudioToolbarProps) {
  return (
    <div className="pointer-events-auto absolute left-5 top-1/2 z-50 -translate-y-1/2">
      <GlassPanel
        variant="default"
        blur="xl"
        className="flex flex-col items-center gap-1 p-1.5"
      >
        {/* Zoom group */}
        <div className="flex flex-col items-center gap-0.5">
          <ToolbarButton
            onClick={onFit}
            aria-label="Fit canvas to all frames"
            title="Fit canvas to all frames"
          >
            <SquareDashed className="size-4" />
          </ToolbarButton>
          {hasSelectedFrame && onFitSelected && (
            <ToolbarButton
              onClick={onFitSelected}
              aria-label="Fit to selected frame"
              title="Fit to selected frame"
            >
              <Focus className="size-4" />
            </ToolbarButton>
          )}
          <div className="my-0.5 h-px w-5 bg-(--studio-border)" />
          <ToolbarButton
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="size-4" />
          </ToolbarButton>
        </div>

        <div className="my-0.5 h-px w-5 bg-(--studio-border)" />

        {/* Zoom percent */}
        <div className="flex h-7 items-center justify-center rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] px-2 text-[10px] font-medium text-[var(--studio-text-muted)]">
          {zoomPercent}%
        </div>
      </GlassPanel>
    </div>
  );
}

function ToolbarButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-[var(--studio-text-secondary)] transition-all duration-150",
        "hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-text-primary)] hover:scale-105 active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
