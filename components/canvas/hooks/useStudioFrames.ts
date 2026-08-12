"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { FrameRect } from "@/components/canvas/types";
import { CanvasFrameData } from "@/components/canvas/types";

const HISTORY_CAP = 50;

function toFrameRects(frames: CanvasFrameData[]): FrameRect[] {
  return frames.map((frame) => ({
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
  }));
}

type FramesUpdater = (
  current: Map<string, CanvasFrameData>,
) => Map<string, CanvasFrameData>;

interface UseStudioFramesOptions {
  /** Sync projection to Zustand (or other store) after each replace. */
  onSync?: (frames: CanvasFrameData[]) => void;
}

export function useStudioFrames({ onSync }: UseStudioFramesOptions = {}) {
  const [frames, setFrames] = useState<Map<string, CanvasFrameData>>(
    () => new Map(),
  );
  const [history, setHistory] = useState<Array<Map<string, CanvasFrameData>>>(
    [],
  );
  const [historyIndex, setHistoryIndex] = useState(-1);

  const latestFramesRef = useRef(frames);
  const historyIndexRef = useRef(historyIndex);
  const gestureBaselineRef = useRef<Map<string, CanvasFrameData> | null>(null);
  const onSyncRef = useRef(onSync);

  onSyncRef.current = onSync;
  historyIndexRef.current = historyIndex;

  const sync = useCallback((next: Map<string, CanvasFrameData>) => {
    latestFramesRef.current = next;
    onSyncRef.current?.([...next.values()]);
  }, []);

  const replaceAll = useCallback(
    (next: Map<string, CanvasFrameData>, options?: { pushHistory?: boolean }) => {
      setFrames(next);
      sync(next);
      if (options?.pushHistory) {
        setHistory((prev) => {
          const truncated = prev.slice(0, historyIndexRef.current + 1);
          truncated.push(next);
          const capped =
            truncated.length > HISTORY_CAP
              ? truncated.slice(truncated.length - HISTORY_CAP)
              : truncated;
          setHistoryIndex(capped.length - 1);
          return capped;
        });
      }
    },
    [sync],
  );

  const updateEphemeral = useCallback(
    (updater: FramesUpdater) => {
      setFrames((current) => {
        const next = updater(current);
        if (next === current) return current;
        sync(next);
        return next;
      });
    },
    [sync],
  );

  const commit = useCallback(
    (updater: FramesUpdater) => {
      setFrames((current) => {
        const next = updater(current);
        if (next === current) {
          return current;
        }
        sync(next);
        setHistory((prev) => {
          const truncated = prev.slice(0, historyIndexRef.current + 1);
          truncated.push(next);
          const capped =
            truncated.length > HISTORY_CAP
              ? truncated.slice(truncated.length - HISTORY_CAP)
              : truncated;
          setHistoryIndex(capped.length - 1);
          return capped;
        });
        return next;
      });
    },
    [sync],
  );

  const beginGesture = useCallback(() => {
    gestureBaselineRef.current = new Map(latestFramesRef.current);
  }, []);

  const endGesture = useCallback(() => {
    const baseline = gestureBaselineRef.current;
    const finalFrames = new Map(latestFramesRef.current);
    gestureBaselineRef.current = null;

    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndexRef.current + 1);
      const next =
        truncated.length === 0 && baseline
          ? [baseline, finalFrames]
          : [...truncated, finalFrames];
      const capped =
        next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
      setHistoryIndex(capped.length - 1);
      return capped;
    });
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevFrames = history[historyIndex - 1];
    setFrames(prevFrames);
    sync(prevFrames);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex, sync]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextFrames = history[historyIndex + 1];
    setFrames(nextFrames);
    sync(nextFrames);
    setHistoryIndex(historyIndex + 1);
  }, [history, historyIndex, sync]);

  const getFramesSnapshot = useCallback(() => latestFramesRef.current, []);

  const frameList = useMemo(() => {
    return [...frames.values()].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }, [frames]);

  const frameRects = useMemo(() => toFrameRects(frameList), [frameList]);

  return {
    frames,
    frameList,
    frameRects,
    replaceAll,
    updateEphemeral,
    commit,
    beginGesture,
    endGesture,
    undo,
    redo,
    canUndo,
    canRedo,
    getFramesSnapshot,
  };
}
