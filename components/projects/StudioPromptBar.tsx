"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6">
      <GlassPanel
        variant="elevated"
        blur="xl"
        className="pointer-events-auto w-full max-w-[900px]"
      >
        <div className="p-3">
          {/* Error banner */}
          {(generationErrorMessage || generationRecoveryPrompt) && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--studio-error)]/20 bg-[var(--studio-error)]/10 px-3 py-2">
              <span className="line-clamp-2 text-xs text-[var(--studio-error)]">
                {generationErrorMessage ||
                  "Generation was interrupted before it finished."}
              </span>
              {generationRecoveryPrompt && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onResumeGeneration}
                  disabled={isGenerating}
                  className="shrink-0"
                >
                  Resume generation
                </Button>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            <textarea
              ref={commandInputRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeFrameId
                  ? "Enter a prompt to regenerate the selected frame, or leave blank to reuse the original prompt."
                  : "Enter a prompt to generate a new layout, or leave blank to reuse the original prompt."
              }
              className={cn(
                "flex-1 resize-none rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-2.5 text-sm text-[var(--studio-text-primary)] outline-none transition-all duration-200",
                "placeholder:text-[var(--studio-text-muted)]",
                "focus:border-[var(--studio-accent)] focus:shadow-[0_0_0_3px_var(--studio-accent-glow)]",
                isGenerating && "cursor-not-allowed opacity-70",
                monoClassName,
              )}
              aria-label="UI generation prompt input"
              aria-describedby="prompt-hint"
              aria-disabled={isGenerating}
              disabled={isGenerating}
              rows={1}
            />

            <div className="flex items-center gap-1">
              <Button
                onClick={onGenerate}
                disabled={!canGenerate || isGenerating}
                className={cn(
                  "h-10 rounded-lg px-4 text-sm font-medium transition-all duration-200",
                  "bg-[var(--studio-accent)] text-white hover:bg-[var(--studio-accent)]/90 hover:scale-[1.02] active:scale-[0.98]",
                  "disabled:opacity-50 disabled:hover:scale-100",
                )}
              >
                <Sparkles
                  className={cn(
                    "mr-1.5 size-4",
                    isGenerating && "animate-spin",
                  )}
                />
                {isGenerating
                  ? "Generating..."
                  : activeFrameId
                    ? generationMode === "regenerate"
                      ? "Regenerate"
                      : "Generate"
                    : "Generate"}
              </Button>

              {activeFrameId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onToggleGenerationMode}
                  disabled={isGenerating}
                  className={cn(
                    "h-10 rounded-lg border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-text-secondary)] text-xs font-semibold",
                    "hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-text-primary)]",
                  )}
                  title={
                    generationMode === "generate"
                      ? "Switch to regenerate mode"
                      : "Switch to generate mode"
                  }
                >
                  {generationMode === "generate" ? "G" : "R"}
                </Button>
              )}
            </div>
          </div>

          <span id="prompt-hint" className="sr-only">
            Type a description of the UI you want to create. Press Enter to
            generate or Escape to clear.
          </span>
        </div>
      </GlassPanel>
    </div>
  );
}
