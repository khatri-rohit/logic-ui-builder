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
      setSelectedFrameId(frameId);
      onModeChange?.("frame-active");
    },
    [onModeChange],
  );

  /** Exit preview interaction; keep the frame selected. */
  const exitFrame = useCallback(() => {
    setMode("canvas");
    setActiveFrameId(null);
    onModeChange?.("canvas");
  }, [onModeChange]);

  const deselect = useCallback(() => {
    setSelectedFrameId(null);
    setActiveFrameId(null);
    setMode("canvas");
    onModeChange?.("canvas");
  }, [onModeChange]);

  const openEditor = useCallback(
    (frameId: string) => {
      setMode("editor");
      setActiveFrameId(frameId);
      setSelectedFrameId(frameId);
      onModeChange?.("editor");
    },
    [onModeChange],
  );

  const closeEditor = useCallback(() => {
    setMode("canvas");
    setActiveFrameId(null);
    onModeChange?.("canvas");
  }, [onModeChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (mode === "frame-active") {
        exitFrame();
        return;
      }

      if (mode === "editor") {
        closeEditor();
        return;
      }

      if (selectedFrameId) {
        deselect();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeEditor, deselect, exitFrame, mode, selectedFrameId]);

  return {
    mode,
    activeFrameId,
    selectedFrameId,
    setSelectedFrameId,
    setActiveFrameId,
    enterFrame,
    exitFrame,
    deselect,
    openEditor,
    closeEditor,
  };
}
