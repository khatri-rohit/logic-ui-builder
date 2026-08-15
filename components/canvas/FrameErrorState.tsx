"use client";

import { Lock } from "lucide-react";

interface FrameErrorStateProps {
  readOnly?: boolean;
  canRegenerate?: boolean;
  onTryAgain?: () => void;
  onLockedAction?: (featureName: string) => void;
}

/**
 * Calm host-level retry surface for failed / incomplete frames.
 * Never shows stack traces, generated source, or panic-colored alerts.
 */
export function FrameErrorState({
  readOnly = false,
  canRegenerate = true,
  onTryAgain,
  onLockedAction,
}: FrameErrorStateProps) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center bg-(--studio-surface) px-8 py-10 text-center"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="w-full max-w-sm">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/40">
          Canvas preview
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground/90">
          This screen didn’t finish
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/55">
          Try again to generate it with the locked design system.
        </p>

        {!readOnly && (
          <div className="mt-6 flex justify-center">
            {canRegenerate ? (
              <button
                type="button"
                className="rounded-md border border-foreground/15 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-foreground/10"
                onClick={() => onTryAgain?.()}
              >
                Try again
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-foreground/5 px-4 py-2 text-sm font-medium text-foreground/45"
                onClick={() => onLockedAction?.("Regenerate")}
              >
                Try again
                <Lock className="size-3 text-amber-400" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
