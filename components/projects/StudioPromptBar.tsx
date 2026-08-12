"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CornerDownLeft,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  activeStreamingScreen?: string | null;
}

type PromptBarPhase = "expanded" | "generating" | "completed";

const MAX_PROMPT_HEIGHT = 220;
const MIN_PROMPT_HEIGHT = 52;
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

function toHeadline(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-(--studio-border) bg-(--studio-surface-hover) px-1.5 font-sans text-[10px] font-medium text-(--studio-text-muted)">
      {children}
    </kbd>
  );
}

function StreamingDots() {
  return (
    <span className="relative flex items-center gap-1" aria-hidden="true">
      <span className="size-1 animate-streaming-dot rounded-full bg-(--studio-accent)" />
      <span
        className="size-1 animate-streaming-dot rounded-full bg-(--studio-accent)"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="size-1 animate-streaming-dot rounded-full bg-(--studio-accent)"
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}

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
  activeStreamingScreen = null,
}: StudioPromptBarProps) {
  const reduceMotion = useReducedMotion();
  const [isFocused, setIsFocused] = React.useState(false);
  const [phase, setPhase] = React.useState<PromptBarPhase>("expanded");
  const [collapsedPromptHeadline, setCollapsedPromptHeadline] =
    React.useState("");
  const wasGeneratingRef = React.useRef(false);

  const showErrorBanner =
    generationErrorMessage != null || generationRecoveryPrompt != null;

  React.useEffect(() => {
    if (isGenerating) {
      if (!wasGeneratingRef.current) {
        setCollapsedPromptHeadline(toHeadline(prompt) || "Generating your UI…");
      }
      wasGeneratingRef.current = true;
      setPhase("generating");
      return;
    }

    if (wasGeneratingRef.current) {
      wasGeneratingRef.current = false;
      if (showErrorBanner) {
        setPhase("expanded");
      } else {
        setPhase("completed");
      }
    }
  }, [isGenerating, prompt, showErrorBanner]);

  React.useEffect(() => {
    if (showErrorBanner && !isGenerating) {
      setPhase("expanded");
    }
  }, [showErrorBanner, isGenerating]);

  React.useEffect(() => {
    if (phase !== "expanded") return;
    const el = commandInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(
      Math.max(el.scrollHeight, MIN_PROMPT_HEIGHT),
      MAX_PROMPT_HEIGHT,
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY =
      el.scrollHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, [prompt, commandInputRef, phase]);

  const expandFromCompleted = React.useEffectEvent(() => {
    if (phase === "completed") {
      setPhase("expanded");
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canGenerate) onGenerate();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canGenerate) onGenerate();
    }
    if (e.key === "Escape") {
      onEscape();
    }
  };

  const handleCompletedPillKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      expandFromCompleted();
    }
  };

  const placeholder = activeFrameId
    ? generationMode === "regenerate"
      ? "Describe changes to regenerate the selected frame, or leave blank to reuse the original prompt."
      : "Describe the new frame you want to generate."
    : "Describe the UI you want to generate — e.g. a SaaS dashboard for managing team tasks.";

  const actionLabel = activeFrameId
    ? generationMode === "regenerate"
      ? "Regenerate"
      : "Generate"
    : "Generate";

  const headline =
    collapsedPromptHeadline || toHeadline(prompt) || "Your prompt";

  const motionTransition = reduceMotion
    ? { duration: 0.15 }
    : { duration: 0.28, ease: MOTION_EASE };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-5 sm:pb-6">
      <div className="pointer-events-auto relative flex w-full max-w-2xl justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "generating" ? (
            <motion.div
              key="prompt-pill-generating"
              layout
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.98 }
              }
              transition={motionTransition}
              className="w-full max-w-md"
            >
              <div
                className={cn(
                  "relative mx-auto flex max-w-full items-center gap-2.5 overflow-hidden rounded-full",
                  "border border-(--studio-accent)/30 bg-(--studio-bg)/90 px-3.5 py-2.5",
                  "shadow-[0_10px_36px_rgba(0,0,0,0.4),0_0_0_1px_var(--studio-accent-glow)]",
                  "backdrop-blur-xl",
                )}
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 animate-prompt-pill-sheen bg-[linear-gradient(110deg,transparent_25%,var(--studio-accent-glow)_50%,transparent_75%)] opacity-60"
                />
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-(--studio-accent)/15">
                  <Loader2 className="size-3.5 animate-spin text-(--studio-accent)" />
                </span>
                <div className="relative min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium tracking-tight text-(--studio-text-primary)">
                    {headline}
                  </p>
                  {activeStreamingScreen ? (
                    <p className="truncate text-[10px] text-(--studio-text-muted)">
                      Crafting {activeStreamingScreen}…
                    </p>
                  ) : (
                    <p className="truncate text-[10px] text-(--studio-text-muted)">
                      Generating…
                    </p>
                  )}
                </div>
                <StreamingDots />
              </div>
            </motion.div>
          ) : phase === "completed" ? (
            <motion.div
              key="prompt-pill-completed"
              layout
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.98 }
              }
              transition={motionTransition}
              className="w-full max-w-xl"
            >
              <button
                type="button"
                onMouseEnter={expandFromCompleted}
                onFocus={expandFromCompleted}
                onClick={expandFromCompleted}
                onKeyDown={handleCompletedPillKeyDown}
                className={cn(
                  "relative mx-auto flex w-full max-w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-full text-left",
                  "border border-(--studio-success)/35 bg-(--studio-bg)/90 px-3.5 py-2.5",
                  "shadow-[0_10px_36px_rgba(0,0,0,0.4),0_0_0_1px_color-mix(in_oklab,var(--studio-success)_28%,transparent)]",
                  "backdrop-blur-xl outline-none transition-colors",
                  "hover:border-(--studio-success)/50 focus-visible:ring-2 focus-visible:ring-(--studio-success)/40",
                )}
                aria-label="Screens ready. Hover or press to expand the prompt bar."
              >
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-(--studio-success)/15">
                  <Check className="size-3.5 text-(--studio-success)" />
                </span>
                <div className="relative min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium tracking-tight text-(--studio-text-primary)">
                    Screens ready
                    <span className="text-(--studio-text-muted)"> · </span>
                    <span className="font-normal text-(--studio-text-secondary)">
                      {headline}
                    </span>
                  </p>
                  <p className="truncate text-[10px] text-(--studio-text-muted)">
                    Hover to edit
                  </p>
                </div>
                <Sparkles
                  className="relative size-3.5 shrink-0 text-(--studio-success)/80"
                  aria-hidden="true"
                />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="prompt-bar-expanded"
              layout
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 10, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.98 }
              }
              transition={motionTransition}
              className="w-full"
            >
              <GlassPanel
                variant="elevated"
                blur="xl"
                className={cn(
                  "relative overflow-hidden transition-[box-shadow,border-color] duration-300",
                  isFocused &&
                    "border-(--studio-accent)/35 shadow-[0_16px_56px_rgba(0,0,0,0.42),0_0_0_1px_var(--studio-accent-glow)]",
                )}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--studio-accent)/40 to-transparent"
                />

                <div className="flex flex-col gap-2.5 p-3 sm:p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFrameId && (
                      <div className="flex shrink-0 items-center rounded-full border border-(--studio-border) bg-(--studio-surface) p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (generationMode !== "generate")
                              onToggleGenerationMode();
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200",
                            generationMode === "generate"
                              ? "bg-(--studio-accent) text-white shadow-[0_4px_14px_var(--studio-accent-glow)]"
                              : "text-(--studio-text-secondary) hover:text-(--studio-text-primary)",
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
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200",
                              generationMode === "regenerate"
                                ? "bg-(--studio-accent) text-white shadow-[0_4px_14px_var(--studio-accent-glow)]"
                                : "text-(--studio-text-secondary) hover:text-(--studio-text-primary)",
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
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-(--studio-text-secondary) transition-all hover:text-(--studio-text-primary)"
                            title="Regeneration is a premium feature"
                          >
                            <Lock className="size-3 text-amber-400" />
                            <span className="opacity-50">Regenerate</span>
                          </button>
                        )}
                      </div>
                    )}

                    {showErrorBanner && (
                      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--studio-error)/20 bg-(--studio-error)/10 px-3 py-2">
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
                            className="h-7 shrink-0 text-[11px]"
                          >
                            Resume
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "group/composer relative rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200",
                      "border-(--studio-border) bg-(--studio-surface)",
                      isFocused &&
                        "border-(--studio-accent)/40 bg-(--studio-surface-hover) shadow-[inset_0_0_0_1px_var(--studio-accent-glow)]",
                    )}
                  >
                    <textarea
                      ref={commandInputRef}
                      value={prompt}
                      onChange={(e) => onPromptChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder={placeholder}
                      className={cn(
                        "block w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[14px] leading-relaxed text-(--studio-text-primary) outline-none",
                        "placeholder:text-(--studio-text-muted)/80",
                        "selection:bg-(--studio-accent)/25",
                        monoClassName,
                      )}
                      style={{ minHeight: MIN_PROMPT_HEIGHT }}
                      aria-label="UI generation prompt input"
                      aria-describedby="prompt-hint"
                      rows={2}
                    />

                    <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
                      <div
                        id="prompt-hint"
                        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-(--studio-text-muted)"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Kbd>
                            <CornerDownLeft className="size-2.5" />
                          </Kbd>
                          <span>send</span>
                        </span>
                        <span className="text-(--studio-border-strong)">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd>Shift</Kbd>
                          <span>+</span>
                          <Kbd>
                            <CornerDownLeft className="size-2.5" />
                          </Kbd>
                          <span>newline</span>
                        </span>
                        {activeFrameId && (
                          <>
                            <span className="text-(--studio-border-strong)">
                              ·
                            </span>
                            <span>Esc deselect</span>
                          </>
                        )}
                      </div>

                      <Button
                        onClick={onGenerate}
                        disabled={!canGenerate || isGenerating}
                        aria-label={actionLabel}
                        className={cn(
                          "h-9 shrink-0 gap-1.5 rounded-full px-4 text-[12px] font-semibold transition-all duration-200",
                          "bg-(--studio-accent) text-white shadow-[0_6px_20px_var(--studio-accent-glow)]",
                          "hover:bg-(--studio-accent)/90 hover:scale-[1.02] active:scale-[0.98]",
                          "disabled:opacity-45 disabled:hover:scale-100 disabled:shadow-none",
                        )}
                      >
                        <ArrowUp className="size-3.5" />
                        {actionLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
