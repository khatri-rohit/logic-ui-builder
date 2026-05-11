"use client";

import { SquareDashed, ZoomIn, ZoomOut } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";

interface StudioToolbarProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function StudioToolbar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
}: StudioToolbarProps) {
  return (
    <div className="pointer-events-auto absolute left-5 top-1/2 z-50 -translate-y-1/2">
      <GlassPanel
        variant="default"
        blur="xl"
        className="flex flex-col items-center gap-1 p-1.5"
      >
        <ToolbarButton
          onClick={onFit}
          aria-label="Fit canvas to frames"
          title="Fit canvas to frames"
        >
          <SquareDashed className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="size-4" />
        </ToolbarButton>
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
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
