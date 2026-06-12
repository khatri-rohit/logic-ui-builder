"use client";

import * as React from "react";
import {
  AlertCircle,
  Loader2,
  Lock,
  MousePointerClick,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudioPromptBarProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  activeFrameId: string | null;
  generationMode: "generate" | "regenerate";
  onToggleGenerationMode: () => void;
  generationErrorMessage: string | null;
  generationRecoveryPrompt: string | null;
  onResumeGeneration: () => void;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  monoClassName?: string;
  onEscape: () => void;
  onLockedAction?: (feature: string) => void;
  canRegenerate?: boolean;
}

const MAX_PROMPT_HEIGHT = 220;

export function StudioPromptBar({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  canGenerate,
  activeFrameId,
  generationMode,
  onToggleGenerationMode,
  generationErrorMessage,
  generationRecoveryPrompt,
  onResumeGeneration,
  commandInputRef,
  monoClassName,
  onEscape,
  onLockedAction,
  canRegenerate = true,
}: StudioPromptBarProps) {
  // Auto-resize textarea
  React.useEffect(() => {
    const el = commandInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, MAX_PROMPT_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY =
      el.scrollHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, [prompt, commandInputRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate) onGenerate();
    }
    if (e.key === "Escape") {
      onEscape();
    }
  };

  const showErrorBanner =
    generationErrorMessage != null || generationRecoveryPrompt != null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
      <GlassPanel
        variant="elevated"
        blur="xl"
        className="pointer-events-auto w-full max-w-2xl"
      >
        <div className="flex flex-col gap-2 p-3">
          {/* Mode toggle + error row */}
          <div className="flex items-center gap-2">
            {/* Segmented mode toggle (only when a frame is selected) */}
            {activeFrameId && (
              <div className="flex shrink-0 items-center rounded-lg border border-(--studio-border) bg-(--studio-surface) p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (generationMode !== "generate") onToggleGenerationMode();
                  }}
                  disabled={isGenerating}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                    generationMode === "generate"
                      ? "bg-(--studio-accent) text-white shadow-sm"
                      : "text-(--studio-text-secondary) hover:text-(--studio-text-primary)",
                    isGenerating && "opacity-50 cursor-not-allowed",
                  )}
                  title="Generate a new frame (G)"
                >
                  <Plus className="size-3" />
                  Generate
                </button>
                {canRegenerate ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (generationMode !== "regenerate")
                        onToggleGenerationMode();
                    }}
                    disabled={isGenerating}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                      generationMode === "regenerate"
                        ? "bg-(--studio-accent) text-white shadow-sm"
                        : "text-(--studio-text-secondary) hover:text-(--studio-text-primary)",
                      isGenerating && "opacity-50 cursor-not-allowed",
                    )}
                    title="Regenerate the selected frame (R)"
                  >
                    <RotateCcw className="size-3" />
                    Regenerate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLockedAction?.("Regenerate")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                      "text-(--studio-text-secondary) hover:text-(--studio-text-primary)",
                    )}
                    title="Regeneration is a premium feature"
                  >
                    <Lock className="size-3 text-amber-400" />
                    <span className="opacity-50">Regenerate</span>
                  </button>
                )}
              </div>
            )}

            {/* Error / Recovery banner */}
            {showErrorBanner && (
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-(--studio-error)/20 bg-(--studio-error)/10 px-3 py-2">
                <AlertCircle className="size-3.5 shrink-0 text-(--studio-error)" />
                <span className="line-clamp-2 flex-1 text-[11px] text-(--studio-error)">
                  {generationErrorMessage ??
                    "Generation was interrupted before it finished."}
                </span>
                {generationRecoveryPrompt && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onResumeGeneration}
                    disabled={isGenerating}
                    className="shrink-0 h-7 text-[11px]"
                  >
                    Resume
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2">
            <textarea
              ref={commandInputRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeFrameId
                  ? generationMode === "regenerate"
                    ? "Describe changes to regenerate the selected frame, or leave blank to reuse the original prompt."
                    : "Describe the new frame you want to generate."
                  : "Describe the UI you want to generate — e.g. a SaaS dashboard for managing team tasks."
              }
              className={cn(
                "flex-1 resize-none rounded-lg border border-(--studio-border) bg-(--studio-surface) px-4 py-2.5 text-sm text-(--studio-text-primary) outline-none transition-all duration-200",
                "placeholder:text-(--studio-text-muted)",
                "focus:border-(--studio-accent) focus:shadow-[0_0_0_3px_var(--studio-accent-glow)]",
                isGenerating && "cursor-not-allowed opacity-70",
                monoClassName,
              )}
              aria-label="UI generation prompt input"
              aria-describedby="prompt-hint"
              aria-disabled={isGenerating}
              disabled={isGenerating}
              rows={1}
            />

            <Button
              onClick={onGenerate}
              disabled={!canGenerate || isGenerating}
              className={cn(
                "h-10 shrink-0 rounded-lg px-5 text-sm font-semibold transition-all duration-200",
                "bg-(--studio-accent) text-white hover:bg-(--studio-accent)/90 hover:scale-[1.02] active:scale-[0.98]",
                "disabled:opacity-50 disabled:hover:scale-100",
                isGenerating && "ring-2 ring-(--studio-accent)/40 ring-offset-2 ring-offset-(--studio-surface)",
              )}
            >
              {isGenerating ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-4" />
              )}
              {isGenerating
                ? "Generating..."
                : activeFrameId
                  ? generationMode === "regenerate"
                    ? "Regenerate"
                    : "Generate"
                  : "Generate"}
            </Button>
          </div>

          {/* Keyboard hint */}
          <div className="flex items-center justify-between px-0.5">
            <span
              id="prompt-hint"
              className="text-[10px] text-(--studio-text-muted)"
            >
              {activeFrameId ? (
                <span className="flex items-center gap-1">
                  <MousePointerClick className="size-3" />
                  {generationMode === "regenerate"
                    ? "Enter to regenerate selected frame · Escape to deselect"
                    : "Enter to generate a new frame · Escape to deselect"}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MousePointerClick className="size-3" />
                  Press Enter to generate · Ctrl+Enter also works
                </span>
              )}
            </span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
