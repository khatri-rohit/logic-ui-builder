import { useCallback, useEffect, useState } from "react";

export type PointerMode = "canvas" | "frame-active" | "editor";

interface UsePointerModeOptions {
  onModeChange?: (mode: PointerMode) => void;
}

export function usePointerMode({ onModeChange }: UsePointerModeOptions = {}) {
  const [mode, setMode] = useState<PointerMode>("canvas");
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const enterFrame = useCallback(
    (frameId: string) => {
      setMode("frame-active");
      setActiveFrameId(frameId);
      onModeChange?.("frame-active");
    },
    [onModeChange],
  );

  const exitFrame = useCallback(() => {
    setMode("canvas");
    setActiveFrameId(null);
    onModeChange?.("canvas");
    setSelectedFrameId(null);
  }, [onModeChange]);

  const openEditor = useCallback(
    (frameId: string) => {
      setMode("editor");
      setActiveFrameId(frameId);
      onModeChange?.("editor");
    },
    [onModeChange],
  );

  const closeEditor = useCallback(() => {
    setMode("canvas");
    setActiveFrameId(null);
    onModeChange?.("canvas");
    setSelectedFrameId(null);
  }, [onModeChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (mode === "frame-active") {
        exitFrame();
      } else if (mode === "editor") {
        closeEditor();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeEditor, exitFrame, mode]);

  return {
    mode,
    activeFrameId,
    selectedFrameId,
    setSelectedFrameId,
    setActiveFrameId,
    enterFrame,
    exitFrame,
    openEditor,
    closeEditor,
  };
}
