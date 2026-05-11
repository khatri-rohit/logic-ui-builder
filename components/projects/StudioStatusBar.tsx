"use client";

import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Monitor, Smartphone } from "lucide-react";

interface StudioStatusBarProps {
  platform: "web" | "mobile";
  isGenerating: boolean;
  activeStreamingScreen: string | null;
  canvasSaveMessage: string | null;
  activeFrameId: string | null;
  activeFrameName: string | null;
}

export function StudioStatusBar({
  platform,
  isGenerating,
  activeStreamingScreen,
  canvasSaveMessage,
  activeFrameId,
  activeFrameName,
}: StudioStatusBarProps) {
  const hasContent = isGenerating || canvasSaveMessage || activeFrameId;

  if (!hasContent) return null;

  return (
    <div className="pointer-events-auto absolute right-5 top-5 z-50">
      <GlassPanel
        variant="default"
        blur="xl"
        className="flex items-center gap-2 px-3 py-2"
      >
        <PlatformBadge platform={platform} />

        {activeFrameId && activeFrameName && (
          <StatusBadge variant="accent">
            Selected: {activeFrameName}
          </StatusBadge>
        )}

        {isGenerating && (
          <StatusBadge variant="primary">
            <span className="size-1.5 animate-pulse rounded-full bg-(--studio-accent)" />
            {activeStreamingScreen
              ? `Generating: ${activeStreamingScreen}`
              : "Preparing generation..."}
          </StatusBadge>
        )}

        {canvasSaveMessage && (
          <StatusBadge variant="warning">{canvasSaveMessage}</StatusBadge>
        )}
      </GlassPanel>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: "web" | "mobile" }) {
  const Icon = platform === "web" ? Monitor : Smartphone;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-(--studio-border) bg-(--studio-surface) px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-(--studio-text-muted)">
      <Icon className="size-3" />
      {platform}
    </span>
  );
}

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "accent" | "warning" | "error";
}

function StatusBadge({ children, variant = "primary" }: StatusBadgeProps) {
  const variantStyles = {
    primary:
      "border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-text-secondary)]",
    accent:
      "border-[var(--studio-accent-glow)] bg-[var(--studio-accent-glow)] text-[var(--studio-text-primary)]",
    warning:
      "border-[var(--studio-warning)]/20 bg-[var(--studio-warning)]/10 text-[var(--studio-warning)]",
    error:
      "border-[var(--studio-error)]/20 bg-[var(--studio-error)]/10 text-[var(--studio-error)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium",
        variantStyles[variant],
      )}
    >
      {children}
    </span>
  );
}
