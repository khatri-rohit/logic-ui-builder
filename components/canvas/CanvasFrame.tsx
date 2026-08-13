"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

import { useCanvasScaleGetter } from "@/components/canvas/CanvasScaleContext";
import { useFrameLifecycle } from "@/components/canvas/hooks/useFrameLifecycle";
import { CanvasFrameData } from "@/components/canvas/types";
import { useStudioTheme } from "@/components/canvas/StudioThemeContext";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { Lock } from "lucide-react";

const WEB_CHROME_H = 36;
const MOBILE_STATUS_H = 44;
const MOBILE_HOME_H = 34;

const MIN_WEB_W = 360;
const MAX_WEB_W = 4096;
const MIN_WEB_H = 320;
const MAX_WEB_H = 20000;

const MIN_MOBILE_W = 320;
const MAX_MOBILE_W = 430;
const MIN_MOBILE_H = 560;
const MAX_MOBILE_H = 2200;
const DRAG_ACTIVATION_THRESHOLD_PX = 3;

type InteractionState =
  | {
      kind: "drag";
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      hasMoved: boolean;
    }
  | {
      kind: "resize";
      startClientX: number;
      startClientY: number;
      startW: number;
      startH: number;
    };

interface CanvasFrameProps extends CanvasFrameData {
  /** @deprecated Prefer CanvasScaleContext; kept optional for read-only viewers. */
  scale?: number;
  isActive: boolean;
  isSelected: boolean;
  readOnly?: boolean;
  isSpacePressed?: () => boolean;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onAutoFit: (id: string, w: number, h: number) => void;
  onInteractionStart: (id: string) => void;
  onInteractionEnd: (id: string) => void;
  handleFrame: (id: string) => void;
  handleDelete: (id: string) => void;
  handleEditCode: (id: string) => void;
  onOpenHistory?: (id: string) => void;
  canRegenerate?: boolean;
  canEditCode?: boolean;
  onLockedAction?: (featureName: string) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const CanvasFrame = memo(function CanvasFrame({
  id,
  screenName,
  platform,
  x,
  y,
  w,
  h,
  content,
  editedContent,
  state,
  isActive,
  isSelected,
  scale: scaleProp,
  readOnly = false,
  isSpacePressed: isSpacePressedProp,
  onSelect,
  onActivate,
  onMove,
  onResize,
  onAutoFit,
  onInteractionStart,
  onInteractionEnd,
  handleFrame,
  handleDelete,
  handleEditCode,
  onOpenHistory,
  canRegenerate = true,
  canEditCode = true,
  onLockedAction,
}: CanvasFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const didDragRef = useRef(false);
  const didResizeRef = useRef(false);

  const getScaleFromContext = useCanvasScaleGetter();
  const getScale = useCallback(() => {
    if (typeof scaleProp === "number") return Math.max(scaleProp, 0.001);
    return getScaleFromContext();
  }, [getScaleFromContext, scaleProp]);

  const propsRef = useRef({
    onMove,
    onResize,
    onAutoFit,
    onInteractionStart,
    onInteractionEnd,
    onSelect,
    platform,
    w,
    h,
    isSpacePressed: isSpacePressedProp,
  });
  useEffect(() => {
    propsRef.current = {
      onMove,
      onResize,
      onAutoFit,
      onInteractionStart,
      onInteractionEnd,
      onSelect,
      platform,
      w,
      h,
      isSpacePressed: isSpacePressedProp,
    };
  });

  const autoFitRef = useRef({
    contentKey: editedContent ?? content,
    latchedKey: null as string | null,
    userOverride: false,
  });

  const [iframeMenu, setIframeMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const activeContent = editedContent ?? content;

  useEffect(() => {
    autoFitRef.current = {
      contentKey: activeContent,
      latchedKey: null,
      userOverride: false,
    };
  }, [activeContent]);

  useFrameLifecycle({
    content: activeContent,
    state,
    containerRef,
    iframeRef,
  });

  const isSpaceDown = useCallback(() => {
    return propsRef.current.isSpacePressed?.() ?? false;
  }, []);

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const { onMove: move, onResize: resize, platform: plat } =
        propsRef.current;
      const safeScale = getScale();
      const deltaX = (event.clientX - interaction.startClientX) / safeScale;
      const deltaY = (event.clientY - interaction.startClientY) / safeScale;

      if (interaction.kind === "drag") {
        if (!interaction.hasMoved) {
          const movedEnough =
            Math.abs(deltaX) >= DRAG_ACTIVATION_THRESHOLD_PX ||
            Math.abs(deltaY) >= DRAG_ACTIVATION_THRESHOLD_PX;
          if (!movedEnough) return;
          interactionRef.current = { ...interaction, hasMoved: true };
        }
        didDragRef.current = true;
        move(id, interaction.startX + deltaX, interaction.startY + deltaY);
        return;
      }

      const minW = plat === "web" ? MIN_WEB_W : MIN_MOBILE_W;
      const maxW = plat === "web" ? MAX_WEB_W : MAX_MOBILE_W;
      const minH = plat === "web" ? MIN_WEB_H : MIN_MOBILE_H;
      const maxH = plat === "web" ? MAX_WEB_H : MAX_MOBILE_H;
      const nextW = clamp(Math.round(interaction.startW + deltaX), minW, maxW);
      const nextH = clamp(Math.round(interaction.startH + deltaY), minH, maxH);
      didResizeRef.current = true;
      autoFitRef.current.userOverride = true;
      resize(id, nextW, nextH);
    },
    [getScale, id],
  );

  const stopInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    const shouldCommit =
      (interaction?.kind === "drag" && didDragRef.current) ||
      (interaction?.kind === "resize" && didResizeRef.current);

    interactionRef.current = null;
    window.removeEventListener("pointermove", handleWindowPointerMove);

    if (shouldCommit) {
      propsRef.current.onInteractionEnd(id);
    }
  }, [handleWindowPointerMove, id]);

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || isActive || event.button !== 0) return;
      if (isSpaceDown()) return;

      event.preventDefault();
      event.stopPropagation();
      onSelect(id);
      didDragRef.current = false;
      propsRef.current.onInteractionStart(id);

      interactionRef.current = {
        kind: "drag",
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: x,
        startY: y,
        hasMoved: false,
      };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", stopInteraction, { once: true });
      window.addEventListener("pointercancel", stopInteraction, {
        once: true,
      });
    },
    [
      handleWindowPointerMove,
      id,
      isActive,
      isSpaceDown,
      onSelect,
      readOnly,
      stopInteraction,
      x,
      y,
    ],
  );

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (readOnly || isActive || event.button !== 0) return;
      if (isSpaceDown()) return;

      event.preventDefault();
      event.stopPropagation();
      onSelect(id);
      didResizeRef.current = false;
      propsRef.current.onInteractionStart(id);

      interactionRef.current = {
        kind: "resize",
        startClientX: event.clientX,
        startClientY: event.clientY,
        startW: w,
        startH: h,
      };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", stopInteraction, { once: true });
      window.addEventListener("pointercancel", stopInteraction, {
        once: true,
      });
    },
    [
      handleWindowPointerMove,
      h,
      id,
      isActive,
      isSpaceDown,
      onSelect,
      readOnly,
      stopInteraction,
      w,
    ],
  );

  useEffect(() => {
    if (state !== "done") return;

    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === "frame-pointer-down") {
        setIframeMenu(null);
        return;
      }

      if (event.data?.type === "frame-context-menu") {
        const iframeBounds = iframeRef.current?.getBoundingClientRect();
        if (!iframeBounds) return;

        const localX = Number(event.data.clientX);
        const localY = Number(event.data.clientY);
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) return;

        propsRef.current.onSelect(id);
        setIframeMenu({
          x: iframeBounds.left + localX,
          y: iframeBounds.top + localY,
        });
        return;
      }

      if (event.data?.type !== "frame-dimensions") return;
      if (interactionRef.current) return;
      if (readOnly) return;

      const latch = autoFitRef.current;
      if (latch.userOverride) return;
      if (latch.latchedKey === latch.contentKey) return;

      const reportedHeight = Number(event.data.height) || 0;
      if (!reportedHeight) return;

      const chromeHeight =
        platform === "web" ? WEB_CHROME_H : MOBILE_STATUS_H + MOBILE_HOME_H;

      const nextHeight =
        platform === "web"
          ? clamp(Math.ceil(reportedHeight) + chromeHeight, MIN_WEB_H, MAX_WEB_H)
          : clamp(
              Math.ceil(reportedHeight) + chromeHeight,
              MIN_MOBILE_H,
              MAX_MOBILE_H,
            );

      latch.latchedKey = latch.contentKey;
      if (Math.abs(nextHeight - h) < 4) return;

      propsRef.current.onAutoFit(id, w, nextHeight);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [h, id, platform, readOnly, state, w]);

  useEffect(() => {
    const moveHandler = handleWindowPointerMove;
    return () => {
      window.removeEventListener("pointermove", moveHandler);
      interactionRef.current = null;
    };
  }, [handleWindowPointerMove]);

  const chromeTopHeight = platform === "web" ? WEB_CHROME_H : MOBILE_STATUS_H;
  const chromeBottomHeight = platform === "mobile" ? MOBILE_HOME_H : 0;
  const iframeHeight = h - chromeTopHeight - chromeBottomHeight;

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          data-canvas-frame={id}
          className="absolute"
          style={{
            left: x,
            top: y,
            width: w,
            height: h,
          }}
        >
          <div className="absolute -top-6 left-0 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/45">
              {screenName}
            </span>
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-xl bg-white shadow-2xl"
            style={{
              boxShadow: isActive
                ? "0 0 0 2px var(--studio-accent), 0 24px 64px rgba(0,0,0,0.35)"
                : isSelected
                  ? "0 0 0 1.5px var(--studio-accent-glow), 0 16px 48px rgba(0,0,0,0.30)"
                  : "0 4px 24px rgba(0,0,0,0.20)",
              transition: "box-shadow 0.2s ease",
            }}
          >
            {platform === "web" && <BrowserChrome screenName={screenName} />}
            {platform === "mobile" && <MobileStatusBar />}

            {(state === "skeleton" || state === "streaming") && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-(--frame-skeleton-bg)"
                style={{ top: chromeTopHeight, height: iframeHeight }}
              >
                {state === "skeleton" ? <SkeletonView /> : <StreamingView />}
              </div>
            )}

            {state === "done" && (
              <iframe
                ref={iframeRef}
                allow="cross-origin-isolated"
                style={{
                  position: "absolute",
                  top: chromeTopHeight,
                  left: 0,
                  width: "100%",
                  height: iframeHeight,
                  border: "none",
                  zIndex: 2,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              />
            )}

            {state === "error" && (
              <div
                className="absolute inset-0 bg-(--studio-surface) p-6"
                style={{ top: chromeTopHeight, height: iframeHeight }}
              >
                <div className="h-full rounded-xl border border-(--studio-border) bg-(--frame-skeleton-bg) p-6">
                  <div className="h-3 w-24 rounded bg-(--studio-text-muted)/20" />
                  <div className="mt-4 h-8 w-2/3 rounded bg-(--studio-text-muted)/15" />
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <div className="h-24 rounded-lg bg-(--studio-text-muted)/10" />
                    <div className="h-24 rounded-lg bg-(--studio-text-muted)/10" />
                  </div>
                </div>
              </div>
            )}

            {platform === "mobile" && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex h-8.5 items-center justify-center bg-(--status-bar-bg)">
                <div className="h-1.5 w-16 rounded-full bg-foreground/40" />
              </div>
            )}

            <div
              className="absolute inset-0 z-20"
              style={{
                pointerEvents: isActive ? "none" : "auto",
                cursor: isActive ? "default" : "move",
                touchAction: "none",
              }}
              onPointerDown={startDrag}
              onClick={(event) => {
                event.stopPropagation();
                if (!didDragRef.current) {
                  onSelect(id);
                }
                didDragRef.current = false;
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onSelect(id);
                if (state === "done") {
                  onActivate(id);
                }
              }}
              onContextMenu={() => {
                onSelect(id);
              }}
            />

            {!isActive && !readOnly && (
              <button
                type="button"
                aria-label="Resize frame"
                className="absolute bottom-1 right-1 z-30 h-3 w-3 rounded-sm border border-foreground/50 bg-foreground/50 hover:bg-foreground/70"
                style={{ cursor: "se-resize" }}
                onPointerDown={startResize}
              />
            )}
          </div>

          {isActive && (
            <div className="absolute -top-6 left-0 z-40 pointer-events-none">
              <span className="font-mono text-[9px] text-blue-500/70">
                ESC to exit frame mode
              </span>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      {!(state === "skeleton" || state === "streaming") && !readOnly && (
        <ContextMenuContent
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          {state === "done" &&
            (canEditCode ? (
              <ContextMenuItem onSelect={() => handleEditCode(id)}>
                Edit Code
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={() => onLockedAction?.("Edit Code")}>
                <span className="opacity-50">Edit Code</span>
                <Lock className="ml-auto size-3 text-amber-400" />
              </ContextMenuItem>
            ))}
          {canRegenerate ? (
            <ContextMenuItem onSelect={() => handleFrame(id)}>
              Regenerate
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => onLockedAction?.("Regenerate")}>
              <span className="opacity-50">Regenerate</span>
              <Lock className="ml-auto size-3 text-amber-400" />
            </ContextMenuItem>
          )}
          {canRegenerate && onOpenHistory && (
            <ContextMenuItem onSelect={() => onOpenHistory(id)}>
              History
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => handleDelete(id)}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
    {iframeMenu && !(state === "skeleton" || state === "streaming") && !readOnly && (
      <div
        className="fixed inset-0 z-100"
        onPointerDown={() => setIframeMenu(null)}
      >
        <div
          role="menu"
          className="absolute z-101 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: iframeMenu.x, top: iframeMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {state === "done" && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                setIframeMenu(null);
                if (canEditCode) handleEditCode(id);
                else onLockedAction?.("Edit Code");
              }}
            >
              Edit Code
              {!canEditCode && <Lock className="ml-auto size-3 text-amber-400" />}
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              setIframeMenu(null);
              if (canRegenerate) handleFrame(id);
              else onLockedAction?.("Regenerate");
            }}
          >
            Regenerate
            {!canRegenerate && <Lock className="ml-auto size-3 text-amber-400" />}
          </button>
          {canRegenerate && onOpenHistory && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                setIframeMenu(null);
                onOpenHistory(id);
              }}
            >
              History
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              setIframeMenu(null);
              handleDelete(id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    )}
    </>
  );
});

function SkeletonView() {
  return (
    <div className="relative w-3/4 overflow-hidden space-y-3">
      {[80, 60, 90, 50, 70].map((width, index) => (
        <div
          key={index}
          className="h-3 rounded-md bg-foreground/6"
          style={{ width: `${width}%` }}
        >
          <div
            className="h-full w-full animate-shimmer rounded-md"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function StreamingView() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="size-2 rounded-full bg-(--studio-accent)"
            style={{
              animation: `streaming-dot 1s ease-in-out ${index * 120}ms infinite`,
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-(--studio-text-muted)">
        Generating...
      </span>
    </div>
  );
}

function BrowserChrome({ screenName }: { screenName: string }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-9 items-center gap-2 border-b border-black/20 bg-[#f0f0f0] px-3">
      <div className="flex gap-1.5">
        <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <div className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="ml-2 max-w-xs flex-1 truncate rounded bg-background/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        /{screenName.toLowerCase().replace(/\s+/g, "-")}
      </div>
    </div>
  );
}

function MobileStatusBar() {
  const { isDark } = useStudioTheme();
  const iconFill = isDark ? "white" : "#171717";

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-end justify-between bg-(--status-bar-bg) px-5 pb-2">
      <span className="text-[13px] font-semibold text-(--status-bar-text)">
        9:41
      </span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-end gap-0.5">
          {[3, 5, 7, 9, 11].map((height, index) => (
            <div
              key={index}
              className="w-0.75 rounded-[1px] bg-(--status-bar-text)"
              style={{ height }}
            />
          ))}
        </div>
        <svg
          width="14"
          height="10"
          viewBox="0 0 14 10"
          fill={iconFill}
          opacity={0.9}
        >
          <path d="M7 7.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0-3a4 4 0 0 1 2.83 1.17l1.06-1.06A5.5 5.5 0 0 0 7 3a5.5 5.5 0 0 0-3.89 1.61l1.06 1.06A4 4 0 0 1 7 4.5zm0-3a7 7 0 0 1 4.95 2.05l1.06-1.06A8.5 8.5 0 0 0 7 0a8.5 8.5 0 0 0-6.01 2.49l1.06 1.06A7 7 0 0 1 7 1.5z" />
        </svg>
        <div
          className="relative flex h-3 w-5.5 items-center overflow-hidden rounded-xs border px-0.5"
          style={{
            borderColor: `color-mix(in oklab, ${iconFill} 70%, transparent)`,
          }}
        >
          <div className="h-2 w-3.5 rounded-[1px] bg-(--status-bar-text)" />
          <div
            className="absolute -right-0.75 top-1/2 h-1.5 w-0.5 -translate-y-1/2 rounded-r"
            style={{
              backgroundColor: `color-mix(in oklab, ${iconFill} 50%, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
