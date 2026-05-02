"use client";

import { cn } from "@/lib/utils";
import { FramePlatform } from "./types";

interface SkeletonFrameProps {
  id: string;
  screenName: string;
  platform: FramePlatform;
  x: number;
  y: number;
  w: number;
  h: number;
  isSelected?: boolean;
  className?: string;
}

const WEB_HEADER_HEIGHT = 36;
const MOBILE_STATUS_BAR_HEIGHT = 44;
const MOBILE_HOME_INDICATOR_HEIGHT = 34;

export function SkeletonFrame({
  id,
  screenName,
  platform,
  x,
  y,
  w,
  h,
  isSelected = false,
  className,
}: SkeletonFrameProps) {
  const isMobile = platform === "mobile";

  const headerHeight = isMobile ? MOBILE_STATUS_BAR_HEIGHT : WEB_HEADER_HEIGHT;
  const contentHeight = h - headerHeight - (isMobile ? MOBILE_HOME_INDICATOR_HEIGHT : 0);

  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-lg border-2 transition-colors duration-200",
        isSelected
          ? "border-primary/80 shadow-lg shadow-primary/20"
          : "border-border/50",
        className,
      )}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
      }}
      role="region"
      aria-label={`Loading: ${screenName}`}
      aria-busy="true"
    >
      {/* Header Bar */}
      <div
        className="flex h-[36px] items-center justify-between border-b border-border/30 bg-muted/30 px-3"
        style={{ height: headerHeight }}
      >
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-2 w-2 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Content Area */}
      <div
        className="relative flex flex-col gap-3 bg-background/50 p-3"
        style={{ height: contentHeight }}
      >
        {/* Simulated Content Blocks */}
        <div className="flex flex-col gap-2">
          {/* Hero / Title Block */}
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />

          {/* Cards Grid */}
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-md border border-border/20 bg-card/30 p-2"
              >
                <div className="h-16 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>

          {/* List Items */}
          <div className="mt-2 flex flex-col gap-1.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded border border-border/20 bg-card/30 p-2"
              >
                <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Action */}
        <div className="mt-auto flex justify-end gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Mobile Home Indicator */}
      {isMobile && (
        <div className="absolute bottom-1 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-muted/50" />
      )}

      {/* Screen Label */}
      <div className="absolute -top-6 left-0 truncate text-xs text-muted-foreground opacity-60">
        {screenName}
      </div>
    </div>
  );
}

export function SkeletonFrameList({
  frames,
  selectedId,
}: {
  frames: Array<{
    id: string;
    screenName: string;
    platform: FramePlatform;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  selectedId?: string;
}) {
  return (
    <>
      {frames.map((frame) => (
        <SkeletonFrame
          key={frame.id}
          id={frame.id}
          screenName={frame.screenName}
          platform={frame.platform}
          x={frame.x}
          y={frame.y}
          w={frame.w}
          h={frame.h}
          isSelected={selectedId === frame.id}
        />
      ))}
    </>
  );
}