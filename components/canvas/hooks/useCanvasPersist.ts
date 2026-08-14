"use client";

import { useCallback, useEffect, useRef } from "react";

import type { InfiniteCanvasHandle } from "@/components/canvas/InfiniteCanvas";
import type { CanvasFrameData } from "@/components/canvas/types";
import type { CanvasSnapshotV1 } from "@/lib/canvas-state";
import type { Transform } from "@/components/canvas/hooks/useCanvasTransform";

interface UseCanvasPersistOptions {
  projectId: string | null | undefined;
  hasHydratedCanvas: () => boolean;
  getFramesSnapshot: () => Map<string, CanvasFrameData>;
  getCanvasTransform: () => Transform;
  getSelection: () => {
    activeFrameId: string | null;
    selectedFrameId: string | null;
  };
  getSelectedGenerationId: () => string | null;
  resolvePersistGenerationId: (generationId?: string) => string | undefined;
  persistCanvasState: (args: {
    id: string;
    canvasState: CanvasSnapshotV1;
    generationId?: string;
  }) => void;
}

export function useCanvasPersist({
  projectId,
  hasHydratedCanvas,
  getFramesSnapshot,
  getCanvasTransform,
  getSelection,
  getSelectedGenerationId,
  resolvePersistGenerationId,
  persistCanvasState,
}: UseCanvasPersistOptions) {
  const snapshotSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const gettersRef = useRef({
    hasHydratedCanvas,
    getFramesSnapshot,
    getCanvasTransform,
    getSelection,
    getSelectedGenerationId,
    resolvePersistGenerationId,
    persistCanvasState,
  });

  useEffect(() => {
    gettersRef.current = {
      hasHydratedCanvas,
      getFramesSnapshot,
      getCanvasTransform,
      getSelection,
      getSelectedGenerationId,
      resolvePersistGenerationId,
      persistCanvasState,
    };
  });

  const buildSnapshot = useCallback((): CanvasSnapshotV1 => {
    const {
      getFramesSnapshot: frames,
      getCanvasTransform: transform,
      getSelection: selection,
      getSelectedGenerationId: generationId,
    } = gettersRef.current;

    const { activeFrameId, selectedFrameId } = selection();

    return {
      version: 1,
      camera: transform(),
      frames: [...frames().values()],
      activeFrameId,
      selectedFrameId,
      selectedGenerationId: generationId(),
      savedAt: new Date().toISOString(),
    };
  }, []);

  const scheduleSnapshotPersist = useCallback(
    (generationId?: string, options: { allowEmpty?: boolean } = {}) => {
      if (!projectId || !gettersRef.current.hasHydratedCanvas()) return;

      if (snapshotSaveTimeoutRef.current) {
        clearTimeout(snapshotSaveTimeoutRef.current);
      }

      const resolvedGenerationId =
        gettersRef.current.resolvePersistGenerationId(generationId);

      snapshotSaveTimeoutRef.current = setTimeout(() => {
        snapshotSaveTimeoutRef.current = null;
        const snapshot = buildSnapshot();
        if (snapshot.frames.length === 0 && !options.allowEmpty) {
          return;
        }
        gettersRef.current.persistCanvasState({
          id: projectId,
          canvasState: snapshot,
          generationId: resolvedGenerationId,
        });
      }, 450);
    },
    [buildSnapshot, projectId],
  );

  const flushPendingSnapshotPersist = useCallback(() => {
    if (!projectId || !gettersRef.current.hasHydratedCanvas()) return;

    if (snapshotSaveTimeoutRef.current) {
      clearTimeout(snapshotSaveTimeoutRef.current);
      snapshotSaveTimeoutRef.current = null;
    }

    gettersRef.current.persistCanvasState({
      id: projectId,
      canvasState: buildSnapshot(),
      generationId: gettersRef.current.resolvePersistGenerationId(),
    });
  }, [buildSnapshot, projectId]);

  useEffect(() => {
    return () => {
      if (snapshotSaveTimeoutRef.current) {
        clearTimeout(snapshotSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    buildSnapshot,
    scheduleSnapshotPersist,
    flushPendingSnapshotPersist,
  };
}

/** Helper for reading transform from canvas handle with fallback. */
export function readCanvasTransform(
  canvasRef: { current: InfiniteCanvasHandle | null },
  fallback: Transform = { x: 0, y: 0, k: 1 },
): Transform {
  return canvasRef.current?.getTransform() ?? fallback;
}
