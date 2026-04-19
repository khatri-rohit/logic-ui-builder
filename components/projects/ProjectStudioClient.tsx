"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { JetBrains_Mono } from "next/font/google";

import { CanvasFrame } from "@/components/canvas/CanvasFrame";
import {
  InfiniteCanvas,
  InfiniteCanvasHandle,
} from "@/components/canvas/InfiniteCanvas";
import {
  Transform,
  FrameRect,
} from "@/components/canvas/hooks/useCanvasTransform";
import { usePointerMode } from "@/components/canvas/hooks/usePointerMode";
import { CanvasFrameData } from "@/components/canvas/types";
import { Button } from "@/components/ui/button";
import SelectModel from "@/components/SelectModel";
import ProjectMenuPanel from "@/components/projects/TopMenu";
import {
  useProjectCanvasStateUpdateMutation,
  useProjectDeleteMutation,
  useProjectQuery,
  useProjectStatusUpdateMutation,
  useProjectThumbnailUpdateMutation,
} from "@/lib/projects/queries";
import {
  useProjectStudioStore,
  useProjectStudioStoreApi,
} from "@/providers/project-studio-provider";
import { useUserActivityStore } from "@/providers/zustand-provider";
import { Monitor, Smartphone, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectStudioRuntimeState } from "@/stores/project-studio";

import { CanvasSnapshotV1, FrameState } from "@/lib/canvas-state";
import {
  getGenerationLayout,
  getInitialDimensionsForPlatform,
} from "@/lib/canvasLayout";
import logger from "@/lib/logger";
import { GenerationPlatform, WebAppSpec } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SandpackProvider } from "@codesandbox/sandpack-react";
import FeedbackForm from "./FeedbackForm";
import { toast } from "sonner";

const DASHBOARD_MODEL_ALIASES: string[] = [
  "gemma4:31b",
  "gpt-oss:120b",
  "deepseek-v3.1:671b",
  "qwen3.5",
  "deepseek-v3.2:cloud",
];

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type GenerationEvent =
  | { type: "generation_id"; generationId: string }
  | { type: "spec"; spec: WebAppSpec }
  | { type: "screen_start"; screen: string }
  | { type: "screen_reset"; screen: string; reason?: string }
  | { type: "code_chunk"; screen: string; token: string }
  | { type: "screen_done"; screen: string }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "design_context"; designContext: unknown }
  | { type: "tree"; tree: unknown };

type FrameGenerationEvent =
  | { type: "generation_id"; generationId: string }
  | { type: "frame_start"; frameId: string; screen: string }
  | { type: "frame_reset"; frameId: string; screen: string; reason?: string }
  | { type: "code_chunk"; frameId: string; token: string }
  | { type: "frame_done"; frameId: string; screen: string }
  | { type: "done" }
  | { type: "error"; message: string };

type ProjectActionId =
  | "all-projects"
  | "share"
  | "download"
  | "edit"
  | "delete"
  | "feedback";

interface ProjectStudioClientProps {
  projectId: string;
}

const CHUNK_FLUSH_MS = 120;
const MAX_PROMPT_HEIGHT = 220;

function toFrameRects(frames: CanvasFrameData[]): FrameRect[] {
  return frames.map((frame) => ({
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
  }));
}

function normalizePosition(value: number) {
  return Math.round(value * 100) / 100;
}

function cloneScreenFrameMap(source: Map<string, string[]>) {
  return new Map(
    [...source.entries()].map(([screenName, frameIds]) => [
      screenName,
      [...frameIds],
    ]),
  );
}

function resolveFrameIdForScreenFromState({
  screenName,
  frames,
  activeFrameIds,
  frameIdsByScreen,
}: {
  screenName: string;
  frames: Map<string, CanvasFrameData>;
  activeFrameIds: Map<string, string>;
  frameIdsByScreen: Map<string, string[]>;
}) {
  const activeFrameId = activeFrameIds.get(screenName);
  if (activeFrameId && frames.has(activeFrameId)) {
    return activeFrameId;
  }

  const frameIds = frameIdsByScreen.get(screenName);
  if (!frameIds || frameIds.length === 0) return null;

  for (const frameId of frameIds) {
    const frame = frames.get(frameId);
    if (!frame) continue;
    if (frame.state !== "done" && frame.state !== "error") {
      return frameId;
    }
  }

  for (const frameId of frameIds) {
    if (frames.has(frameId)) {
      return frameId;
    }
  }

  return null;
}

async function readResponseErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch {
      // Ignore JSON parse failures and fall back to text below.
    }
  }

  try {
    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch {
    // Ignore text parse failures and return fallback.
  }

  return "Generation failed";
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

const ProjectStudioClient = ({ projectId }: ProjectStudioClientProps) => {
  const router = useRouter();

  const {
    data: project,
    isLoading: projectLoading,
    isError,
    error: projectError,
    refetch: refetchProject,
  } = useProjectQuery(projectId);

  const [canvasSaveMessage, setCanvasSaveMessage] = useState<string | null>(
    null,
  );

  const { mutate: updateProjectStatus } = useProjectStatusUpdateMutation();
  const { mutate: persistCanvasState } = useProjectCanvasStateUpdateMutation({
    onConflict: () => {
      setCanvasSaveMessage("Canvas sync conflict detected. Retrying save...");
    },
    onPersisted: () => {
      setCanvasSaveMessage(null);
    },
    onError: () => {
      setCanvasSaveMessage(
        "Unable to save canvas changes right now. Changes may not persist yet.",
      );
    },
  });
  const {
    mutate: deleteProject,
    data: deleteProjectData,
    error: deleteError,
    isSuccess: isDeleteSuccess,
  } = useProjectDeleteMutation();
  const { mutateAsync: updateProjectThumbnail } =
    useProjectThumbnailUpdateMutation();

  const model = useUserActivityStore((state) => state.model);
  const setModel = useUserActivityStore((state) => state.setModel);
  const spec = useUserActivityStore((state) => state.spec);
  const setSpec = useUserActivityStore((state) => state.setSpec);

  const projectStudioStoreApi = useProjectStudioStoreApi();

  const hydrateStudioState = useProjectStudioStore(
    (state) => state.hydrateFromProject,
  );
  const setStudioFrames = useProjectStudioStore(
    (state) => state.setStudioFrames,
  );
  const beginGenerationRun = useProjectStudioStore(
    (state) => state.beginGenerationRun,
  );
  const setRuntimeHydrated = useProjectStudioStore(
    (state) => state.setRuntimeHydrated,
  );
  const setRuntimeInitiatedGeneration = useProjectStudioStore(
    (state) => state.setRuntimeInitiatedGeneration,
  );
  const hasHydratedCanvas = useProjectStudioStore(
    (state) => state.runtime.hasHydratedCanvas,
  );
  const hasInitiatedGeneration = useProjectStudioStore(
    (state) => state.runtime.hasInitiatedGeneration,
  );
  const setStudioSelectedGenerationId = useProjectStudioStore(
    (state) => state.setSelectedGenerationId,
  );

  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const domRef = useRef<HTMLDivElement | null>(null);

  const framesRef = useRef<Map<string, CanvasFrameData>>(new Map());

  const chunkFlushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isUploadingThumbnailRef = useRef(false);
  const activeFrameIdRef = useRef<string | null>(null);
  const selectedFrameIdRef = useRef<string | null>(null);
  const frameRegenerationTokenRef = useRef(0);
  const canvasTransformRef = useRef<Transform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingScreen, setActiveStreamingScreen] = useState<
    string | null
  >(null);
  const [frames, setFrames] = useState<Map<string, CanvasFrameData>>(
    () => new Map(),
  );
  const [canvasTransform, setCanvasTransform] = useState<Transform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const [openFeedbackForm, setOpenFeedbackForm] = useState(false);

  const {
    activeFrameId,
    selectedFrameId,
    setSelectedFrameId,
    enterFrame,
    exitFrame,
  } = usePointerMode();

  const canGenerate = !!prompt.trim() && !isGenerating;
  const models = [...DASHBOARD_MODEL_ALIASES];

  useEffect(() => {
    activeFrameIdRef.current = activeFrameId;
  }, [activeFrameId]);

  useEffect(() => {
    selectedFrameIdRef.current = selectedFrameId;
  }, [selectedFrameId]);

  useEffect(() => {
    canvasTransformRef.current = canvasTransform;
  }, [canvasTransform]);

  const frameList = useMemo(() => {
    return [...frames.values()].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }, [frames]);

  const frameRects = useMemo(() => toFrameRects(frameList), [frameList]);

  const applyFrames = useCallback(
    (
      updater: (
        current: Map<string, CanvasFrameData>,
      ) => Map<string, CanvasFrameData>,
    ) => {
      setFrames((current) => {
        const next = updater(current);
        framesRef.current = next;
        setStudioFrames([...next.values()]);
        return next;
      });
    },
    [setStudioFrames],
  );

  const getStudioRuntime = useCallback(
    () => projectStudioStoreApi.getState().runtime,
    [projectStudioStoreApi],
  );

  const updateStudioRuntime = useCallback(
    (
      updater: (
        runtime: ProjectStudioRuntimeState,
      ) => ProjectStudioRuntimeState,
    ) => {
      projectStudioStoreApi.getState().updateRuntime(updater);
    },
    [projectStudioStoreApi],
  );

  const setActiveGenerationContext = useCallback(
    (generationId: string | null) => {
      updateStudioRuntime((runtime) => ({
        ...runtime,
        activeGenerationId: generationId,
      }));
      setStudioSelectedGenerationId(generationId);
    },
    [setStudioSelectedGenerationId, updateStudioRuntime],
  );

  const resolvePersistGenerationId = useCallback(
    (generationId?: string) => {
      const { runtime, studio } = projectStudioStoreApi.getState();

      return (
        generationId ??
        runtime.activeGenerationId ??
        studio?.selectedGenerationId ??
        undefined
      );
    },
    [projectStudioStoreApi],
  );

  const buildSnapshot = useCallback((): CanvasSnapshotV1 => {
    const camera =
      canvasRef.current?.getTransform() ?? canvasTransformRef.current;

    return {
      version: 1,
      camera,
      frames: [...framesRef.current.values()],
      activeFrameId: activeFrameIdRef.current,
      selectedFrameId: selectedFrameIdRef.current,
      selectedGenerationId:
        projectStudioStoreApi.getState().studio?.selectedGenerationId ?? null,
      savedAt: new Date().toISOString(),
    };
  }, [projectStudioStoreApi]);

  const scheduleSnapshotPersist = useCallback(
    (generationId?: string) => {
      if (!projectId || !getStudioRuntime().hasHydratedCanvas) return;

      if (snapshotSaveTimeoutRef.current) {
        clearTimeout(snapshotSaveTimeoutRef.current);
      }

      const resolvedGenerationId = resolvePersistGenerationId(generationId);

      snapshotSaveTimeoutRef.current = setTimeout(() => {
        snapshotSaveTimeoutRef.current = null;
        if (buildSnapshot().frames.length === 0) {
          // Don't persist empty canvas state as it can overwrite existing state with an empty one in case of a delayed persist call after a new generation has started.
          return;
        }
        persistCanvasState({
          id: projectId,
          canvasState: buildSnapshot(),
          generationId: resolvedGenerationId,
        });
      }, 450);
    },
    [
      buildSnapshot,
      getStudioRuntime,
      persistCanvasState,
      projectId,
      resolvePersistGenerationId,
    ],
  );

  const flushPendingSnapshotPersist = useCallback(() => {
    if (!projectId || !getStudioRuntime().hasHydratedCanvas) return;
    if (!snapshotSaveTimeoutRef.current) return;

    clearTimeout(snapshotSaveTimeoutRef.current);
    snapshotSaveTimeoutRef.current = null;
    persistCanvasState({
      id: projectId,
      canvasState: buildSnapshot(),
      generationId: resolvePersistGenerationId(),
    });
  }, [
    buildSnapshot,
    getStudioRuntime,
    persistCanvasState,
    projectId,
    resolvePersistGenerationId,
  ]);

  const resolveFrameIdForScreen = useCallback(
    (screenName: string) => {
      const runtime = getStudioRuntime();

      return resolveFrameIdForScreenFromState({
        screenName,
        frames: framesRef.current,
        activeFrameIds: runtime.activeFrameIdsByScreen,
        frameIdsByScreen: runtime.frameIdsByScreen,
      });
    },
    [getStudioRuntime],
  );

  const claimFrameIdForScreen = useCallback(
    (screenName: string) => {
      const runtime = getStudioRuntime();
      const existingActiveFrameId =
        runtime.activeFrameIdsByScreen.get(screenName);
      if (existingActiveFrameId) {
        return existingActiveFrameId;
      }

      const frameId = resolveFrameIdForScreen(screenName);
      if (!frameId) return null;

      updateStudioRuntime((current) => {
        const nextActiveFrameIdsByScreen = new Map(
          current.activeFrameIdsByScreen,
        );
        nextActiveFrameIdsByScreen.set(screenName, frameId);

        return {
          ...current,
          activeFrameIdsByScreen: nextActiveFrameIdsByScreen,
        };
      });

      return frameId;
    },
    [getStudioRuntime, resolveFrameIdForScreen, updateStudioRuntime],
  );

  const upsertGenerationReviewEntry = useCallback(
    ({
      frameId,
      screenName,
      generationId,
      state,
      error,
      code,
    }: {
      frameId: string;
      screenName: string;
      generationId: string;
      state: FrameState;
      error: string | null;
      code: string;
    }) => {
      updateStudioRuntime((runtime) => {
        const nextReviewEntries = new Map(runtime.generationReviewEntries);
        nextReviewEntries.set(frameId, {
          screenName,
          generationId,
          state,
          error,
          code,
        });

        return {
          ...runtime,
          generationReviewEntries: nextReviewEntries,
        };
      });
    },
    [updateStudioRuntime],
  );

  const emitGenerationReviewLog = useCallback(
    (reason: string) => {
      const runtime = getStudioRuntime();
      if (runtime.generationLogEmitted) return;

      const runId = runtime.generationRunId;
      if (!runId) return;

      const activeGenerationId = runtime.activeGenerationId;
      let entries = [...runtime.generationReviewEntries.entries()]
        .map(([frameId, entry]) => ({ frameId, ...entry }))
        .filter((entry) =>
          activeGenerationId ? entry.generationId === activeGenerationId : true,
        );

      if (entries.length === 0 && activeGenerationId) {
        entries = [...framesRef.current.values()]
          .filter((frame) => frame.generationId === activeGenerationId)
          .map((frame) => ({
            frameId: frame.id,
            screenName: frame.screenName,
            generationId: frame.generationId,
            state: frame.state,
            error: frame.error,
            code: frame.content,
          }));
      }

      if (entries.length === 0) return;

      updateStudioRuntime((current) => ({
        ...current,
        generationLogEmitted: true,
      }));

      entries.sort((a, b) => {
        if (a.screenName !== b.screenName) {
          return a.screenName.localeCompare(b.screenName);
        }
        return a.frameId.localeCompare(b.frameId);
      });

      logger.info("Generation review payload", {
        projectId,
        runId,
        reason,
        generationId: activeGenerationId,
        screenCount: entries.length,
        screens: entries.map((entry) => ({
          frameId: entry.frameId,
          screenName: entry.screenName,
          state: entry.state,
          error: entry.error,
          codeLength: entry.code.length,
          code: entry.code,
        })),
      });
    },
    [getStudioRuntime, projectId, updateStudioRuntime],
  );

  const flushChunkBuffer = useCallback(() => {
    const runtime = getStudioRuntime();
    if (runtime.dirtyScreens.size === 0) return;

    const dirtyScreens = [...runtime.dirtyScreens];
    const buffersSnapshot = new Map(runtime.screenBuffers);
    const activeFrameIdsSnapshot = new Map(runtime.activeFrameIdsByScreen);
    const frameIdsSnapshot = cloneScreenFrameMap(runtime.frameIdsByScreen);

    updateStudioRuntime((current) => ({
      ...current,
      dirtyScreens: new Set(),
    }));

    applyFrames((current) => {
      let changed = false;
      const next = new Map(current);

      for (const screenName of dirtyScreens) {
        const frameId = resolveFrameIdForScreenFromState({
          screenName,
          frames: next,
          activeFrameIds: activeFrameIdsSnapshot,
          frameIdsByScreen: frameIdsSnapshot,
        });
        if (!frameId) continue;

        const frame = next.get(frameId);
        if (!frame) continue;

        const bufferedContent = buffersSnapshot.get(screenName) ?? "";
        if (bufferedContent === frame.content && frame.state === "streaming") {
          continue;
        }

        changed = true;
        next.set(frameId, {
          ...frame,
          content: bufferedContent,
          state: "streaming",
        });
      }

      return changed ? next : current;
    });
  }, [applyFrames, getStudioRuntime, updateStudioRuntime]);

  const startChunkFlusher = useCallback(() => {
    if (chunkFlushIntervalRef.current) return;

    chunkFlushIntervalRef.current = setInterval(() => {
      flushChunkBuffer();
    }, CHUNK_FLUSH_MS);
  }, [flushChunkBuffer]);

  const stopChunkFlusher = useCallback(() => {
    if (!chunkFlushIntervalRef.current) return;

    clearInterval(chunkFlushIntervalRef.current);
    chunkFlushIntervalRef.current = null;
  }, []);

  const finalizePendingFrames = useCallback(
    ({
      preferError = false,
      errorMessage,
    }: {
      preferError?: boolean;
      errorMessage?: string;
    }) => {
      stopChunkFlusher();

      const runtime = getStudioRuntime();
      const bufferedScreens = [...runtime.screenBuffers.entries()];
      const activeFrameIdsSnapshot = new Map(runtime.activeFrameIdsByScreen);
      const frameIdsSnapshot = cloneScreenFrameMap(runtime.frameIdsByScreen);

      applyFrames((current) => {
        let changed = false;
        const next = new Map(current);

        const finalizeFrame = (frameId: string, bufferedContent?: string) => {
          const frame = next.get(frameId);
          if (!frame) return;

          const resolvedContent = bufferedContent ?? frame.content;
          const hasRenderableContent = resolvedContent.trim().length > 0;
          const nextState =
            preferError || !hasRenderableContent ? "error" : "done";
          const nextError =
            nextState === "error"
              ? (errorMessage ??
                "Generation ended before this screen completed.")
              : null;

          if (
            frame.state === nextState &&
            frame.content === resolvedContent &&
            frame.error === nextError
          ) {
            return;
          }

          changed = true;
          next.set(frameId, {
            ...frame,
            state: nextState,
            content: resolvedContent,
            error: nextError,
          });

          upsertGenerationReviewEntry({
            frameId,
            screenName: frame.screenName,
            generationId: frame.generationId,
            state: nextState,
            error: nextError,
            code: resolvedContent,
          });
        };

        for (const [screenName, bufferedContent] of bufferedScreens) {
          const frameId = resolveFrameIdForScreenFromState({
            screenName,
            frames: next,
            activeFrameIds: activeFrameIdsSnapshot,
            frameIdsByScreen: frameIdsSnapshot,
          });
          if (!frameId) continue;
          finalizeFrame(frameId, bufferedContent);
        }

        for (const [frameId, frame] of next) {
          if (frame.state !== "streaming" && frame.state !== "skeleton") {
            continue;
          }
          finalizeFrame(frameId);
        }

        return changed ? next : current;
      });

      updateStudioRuntime((current) => ({
        ...current,
        activeFrameIdsByScreen: new Map(),
        screenBuffers: new Map(),
        dirtyScreens: new Set(),
      }));

      setActiveStreamingScreen(null);
    },
    [
      applyFrames,
      getStudioRuntime,
      stopChunkFlusher,
      updateStudioRuntime,
      upsertGenerationReviewEntry,
    ],
  );

  const onCapture = useCallback(async () => {
    if (isUploadingThumbnailRef.current || !domRef.current) {
      return;
    }

    isUploadingThumbnailRef.current = true;
    try {
      const captureTarget = domRef.current;

      const thumbnailBlob = await htmlToImage.toBlob(captureTarget, {
        cacheBust: false,
        pixelRatio: 1,
        backgroundColor: "#111111",
      });

      if (!thumbnailBlob) {
        logger.warn("Thumbnail capture returned an empty blob.");
        return;
      }

      await updateProjectThumbnail({
        id: projectId,
        thumbnail: thumbnailBlob,
      });
      logger.info("Project thumbnail updated.", { projectId });
    } catch (error) {
      logger.error("Failed to capture and upload project thumbnail:", error);
    } finally {
      isUploadingThumbnailRef.current = false;
    }
  }, [projectId, updateProjectThumbnail]);

  const restoreFromSnapshot = useCallback(
    (snapshot: CanvasSnapshotV1) => {
      const restoredFrames = new Map<string, CanvasFrameData>(
        snapshot.frames.map((frame) => [frame.id, frame]),
      );

      setFrames(restoredFrames);
      framesRef.current = restoredFrames;
      const restoredFrameIds = new Map<string, string[]>();
      for (const frame of snapshot.frames) {
        const frameIds = restoredFrameIds.get(frame.screenName) ?? [];
        frameIds.push(frame.id);
        restoredFrameIds.set(frame.screenName, frameIds);
      }
      updateStudioRuntime((runtime) => ({
        ...runtime,
        frameIdsByScreen: restoredFrameIds,
        activeFrameIdsByScreen: new Map(),
      }));

      selectedFrameIdRef.current = snapshot.selectedFrameId ?? null;
      activeFrameIdRef.current = snapshot.activeFrameId ?? null;
      setSelectedFrameId(snapshot.selectedFrameId ?? null);
      if (snapshot.activeFrameId) {
        enterFrame(snapshot.activeFrameId);
      } else {
        exitFrame();
      }

      requestAnimationFrame(() => {
        canvasRef.current?.setTransform(snapshot.camera);
        canvasTransformRef.current = snapshot.camera;
        setCanvasTransform(snapshot.camera);
      });
    },
    [enterFrame, exitFrame, setSelectedFrameId, updateStudioRuntime],
  );

  const handleEvent = useCallback(
    (event: GenerationEvent, generationToken: number) => {
      if (generationToken !== getStudioRuntime().generationToken) {
        return;
      }

      if (event.type === "generation_id") {
        setActiveGenerationContext(event.generationId);
        return;
      }

      if (event.type === "design_context" || event.type === "tree") {
        return;
      }

      if (event.type === "spec") {
        const platform: GenerationPlatform =
          event.spec.platform === "mobile" ? "mobile" : "web";

        const screensWithDims = event.spec.screens.map((screenName) => ({
          name: screenName,
          ...getInitialDimensionsForPlatform(screenName, platform),
        }));
        const positions = getGenerationLayout(
          [...framesRef.current.values()],
          screensWithDims,
        );

        const generationId =
          getStudioRuntime().activeGenerationId ?? crypto.randomUUID();
        setActiveGenerationContext(generationId);

        const nextFrameIdsByScreen = new Map<string, string[]>();
        const nextFrames: CanvasFrameData[] = screensWithDims.map(
          (screen, index) => {
            const frameId = crypto.randomUUID();
            const position = positions[index];
            const frameIds = nextFrameIdsByScreen.get(screen.name) ?? [];

            frameIds.push(frameId);
            nextFrameIdsByScreen.set(screen.name, frameIds);

            upsertGenerationReviewEntry({
              frameId,
              screenName: screen.name,
              generationId,
              state: "skeleton",
              error: null,
              code: "",
            });

            return {
              id: frameId,
              screenName: screen.name,
              platform,
              x: position.x,
              y: position.y,
              w: screen.w,
              h: screen.h,
              content: "",
              editedContent: null,
              state: "skeleton",
              generationId,
              error: null,
            };
          },
        );

        updateStudioRuntime((runtime) => ({
          ...runtime,
          frameIdsByScreen: nextFrameIdsByScreen,
          activeFrameIdsByScreen: new Map(),
          screenBuffers: new Map(),
          dirtyScreens: new Set(),
        }));

        applyFrames((current) => {
          const next = new Map(current);
          for (const frame of nextFrames) {
            next.set(frame.id, frame);
          }

          return next;
        });

        requestAnimationFrame(() => {
          const allRects = toFrameRects([...framesRef.current.values()]);
          canvasRef.current?.zoomToFit(allRects);
        });
        scheduleSnapshotPersist(generationId);
        return;
      }

      if (event.type === "screen_start") {
        const frameId = claimFrameIdForScreen(event.screen);
        updateStudioRuntime((runtime) => {
          const nextBuffers = new Map(runtime.screenBuffers);
          nextBuffers.set(event.screen, "");

          return {
            ...runtime,
            screenBuffers: nextBuffers,
          };
        });
        setActiveStreamingScreen(event.screen);
        startChunkFlusher();

        if (!frameId) {
          logger.warn("Unable to resolve frame for screen_start event", {
            screen: event.screen,
            generationId: getStudioRuntime().activeGenerationId,
          });
          return;
        }

        applyFrames((current) => {
          const frame = current.get(frameId);
          if (!frame || frame.state === "streaming") return current;

          const next = new Map(current);
          next.set(frameId, {
            ...frame,
            state: "streaming",
          });
          return next;
        });
        return;
      }

      if (event.type === "screen_reset") {
        const frameId = resolveFrameIdForScreen(event.screen);
        updateStudioRuntime((runtime) => {
          const nextBuffers = new Map(runtime.screenBuffers);
          nextBuffers.set(event.screen, "");

          const nextDirtyScreens = new Set(runtime.dirtyScreens);
          nextDirtyScreens.delete(event.screen);

          return {
            ...runtime,
            screenBuffers: nextBuffers,
            dirtyScreens: nextDirtyScreens,
          };
        });
        startChunkFlusher();

        if (!frameId) return;

        applyFrames((current) => {
          const frame = current.get(frameId);
          if (!frame) return current;

          const next = new Map(current);
          next.set(frameId, {
            ...frame,
            content: "",
            state: "streaming",
          });
          return next;
        });
        return;
      }

      if (event.type === "code_chunk") {
        updateStudioRuntime((runtime) => {
          const previous = runtime.screenBuffers.get(event.screen) ?? "";
          const nextBuffers = new Map(runtime.screenBuffers);
          nextBuffers.set(event.screen, previous + event.token);

          const nextDirtyScreens = new Set(runtime.dirtyScreens);
          nextDirtyScreens.add(event.screen);

          return {
            ...runtime,
            screenBuffers: nextBuffers,
            dirtyScreens: nextDirtyScreens,
          };
        });
        startChunkFlusher();
        return;
      }

      if (event.type === "screen_done") {
        const runtime = getStudioRuntime();

        const frameId = resolveFrameIdForScreenFromState({
          screenName: event.screen,
          frames: framesRef.current,
          activeFrameIds: runtime.activeFrameIdsByScreen,
          frameIdsByScreen: runtime.frameIdsByScreen,
        });

        if (!frameId) {
          logger.warn("Unable to resolve frame for screen_done event", {
            screen: event.screen,
            generationId: runtime.activeGenerationId,
          });
          return;
        }

        const finalCode = runtime.screenBuffers.get(event.screen) ?? "";
        const hasRenderableContent = finalCode.trim().length > 0;
        const nextState: FrameState = hasRenderableContent ? "done" : "error";
        const nextError = hasRenderableContent
          ? null
          : "Generation ended before this screen completed.";
        const frame = framesRef.current.get(frameId);
        const generationId =
          frame?.generationId ?? runtime.activeGenerationId ?? "unknown";

        updateStudioRuntime((current) => {
          const nextBuffers = new Map(current.screenBuffers);
          nextBuffers.delete(event.screen);

          const nextDirtyScreens = new Set(current.dirtyScreens);
          nextDirtyScreens.delete(event.screen);

          const nextActiveFrameIdsByScreen = new Map(
            current.activeFrameIdsByScreen,
          );
          nextActiveFrameIdsByScreen.delete(event.screen);

          return {
            ...current,
            screenBuffers: nextBuffers,
            dirtyScreens: nextDirtyScreens,
            activeFrameIdsByScreen: nextActiveFrameIdsByScreen,
          };
        });

        applyFrames((current) => {
          const frame = current.get(frameId);
          if (!frame) return current;
          const next = new Map(current);
          next.set(frameId, {
            ...frame,
            state: nextState,
            content: finalCode,
            error: nextError,
          });
          return next;
        });

        upsertGenerationReviewEntry({
          frameId,
          screenName: event.screen,
          generationId,
          state: nextState,
          error: nextError,
          code: finalCode,
        });

        setActiveStreamingScreen((current) =>
          current === event.screen ? null : current,
        );
        scheduleSnapshotPersist(generationId);
        return;
      }

      if (event.type === "done") {
        finalizePendingFrames({ preferError: false });

        updateProjectStatus({ id: projectId, status: "ACTIVE" });

        const allRects = toFrameRects([...framesRef.current.values()]);
        if (allRects.length > 0) {
          canvasRef.current?.zoomToFit(allRects);
        }

        if (captureTimeoutRef.current) {
          clearTimeout(captureTimeoutRef.current);
        }

        captureTimeoutRef.current = setTimeout(() => {
          void onCapture();
          captureTimeoutRef.current = null;
        }, 8000);

        emitGenerationReviewLog("done");
        scheduleSnapshotPersist(resolvePersistGenerationId());
        return;
      }

      if (event.type === "error") {
        logger.error("Generation error event received:", {
          message: event.message,
        });
        finalizePendingFrames({
          preferError: true,
          errorMessage: event.message,
        });
        updateProjectStatus({ id: projectId, status: "ACTIVE" });
        emitGenerationReviewLog("error");
        scheduleSnapshotPersist(resolvePersistGenerationId());
      }
    },
    [
      applyFrames,
      claimFrameIdForScreen,
      finalizePendingFrames,
      emitGenerationReviewLog,
      getStudioRuntime,
      onCapture,
      projectId,
      resolveFrameIdForScreen,
      resolvePersistGenerationId,
      scheduleSnapshotPersist,
      setActiveGenerationContext,
      startChunkFlusher,
      updateStudioRuntime,
      upsertGenerationReviewEntry,
      updateProjectStatus,
    ],
  );

  const handleGenerate = useCallback(async () => {
    if (!project) {
      logger.error("Project not found");
      return;
    }

    const generationToken = beginGenerationRun(crypto.randomUUID());
    const isStaleGeneration = () =>
      generationToken !== getStudioRuntime().generationToken;

    setIsGenerating(true);
    setActiveStreamingScreen(null);

    let terminalEventReceived = false;
    let streamFailed = false;

    try {
      stopChunkFlusher();

      const generationPrompt =
        project.status === "PENDING"
          ? project.initialPrompt
          : prompt.trim() || project.initialPrompt;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          projectId: project.id,
          model,
          prompt: generationPrompt,
          platform: spec ?? "web",
        }),
      });

      setPrompt("");

      if (!response.ok || !response.body) {
        const errorMessage = await readResponseErrorMessage(response);
        throw new Error(errorMessage);
      }

      updateProjectStatus({ id: projectId, status: "GENERATING" });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      const processSseLines = (lines: string[]) => {
        for (const line of lines) {
          if (isStaleGeneration()) {
            return true;
          }

          if (!line.startsWith("data:")) continue;

          const raw = line.slice(5).trim();
          if (!raw) continue;

          if (raw === "[DONE]") {
            return true;
          }

          try {
            const event = JSON.parse(raw) as GenerationEvent;
            if (event.type === "done" || event.type === "error") {
              terminalEventReceived = true;
            }
            handleEvent(event, generationToken);
          } catch (parseError) {
            logger.warn("Skipping malformed SSE payload", {
              rawSnippet: raw.slice(0, 200),
              parseError,
            });
          }
        }

        return false;
      };

      while (true) {
        if (isStaleGeneration()) {
          stopChunkFlusher();
          return;
        }

        const { done, value } = await reader.read();

        if (isStaleGeneration()) {
          stopChunkFlusher();
          return;
        }

        if (value) {
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split(/\r?\n/);
          sseBuffer = lines.pop() ?? "";

          if (processSseLines(lines)) {
            stopChunkFlusher();
            return;
          }
        }

        if (done) {
          // Flush decoder state and process any trailing buffered event lines.
          sseBuffer += decoder.decode();

          if (sseBuffer) {
            if (processSseLines(sseBuffer.split(/\r?\n/))) {
              stopChunkFlusher();
              return;
            }
          }

          break;
        }
      }
    } catch (error) {
      if (isStaleGeneration()) {
        return;
      }

      streamFailed = true;
      finalizePendingFrames({
        preferError: true,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Generation failed unexpectedly.",
      });
      updateProjectStatus({ id: projectId, status: "ACTIVE" });
      logger.error("Error generating layout:", error);
      emitGenerationReviewLog("request-failed");
    } finally {
      if (isStaleGeneration()) {
        return;
      }

      if (
        !streamFailed &&
        !terminalEventReceived &&
        getStudioRuntime().frameIdsByScreen.size > 0
      ) {
        logger.warn(
          "Generation stream closed without terminal done/error event; applying completion fallback.",
        );
        finalizePendingFrames({ preferError: false });
        updateProjectStatus({ id: projectId, status: "ACTIVE" });
        emitGenerationReviewLog("stream-close-fallback");
        scheduleSnapshotPersist(resolvePersistGenerationId());
      }

      flushChunkBuffer();
      stopChunkFlusher();
      setActiveStreamingScreen(null);
      setIsGenerating(false);
    }
  }, [
    beginGenerationRun,
    finalizePendingFrames,
    flushChunkBuffer,
    getStudioRuntime,
    handleEvent,
    emitGenerationReviewLog,
    model,
    project,
    projectId,
    prompt,
    resolvePersistGenerationId,
    scheduleSnapshotPersist,
    spec,
    stopChunkFlusher,
    updateProjectStatus,
  ]);

  const handleMoveFrame = useCallback(
    (id: string, nextX: number, nextY: number) => {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;

        const normalizedX = normalizePosition(nextX);
        const normalizedY = normalizePosition(nextY);

        if (frame.x === normalizedX && frame.y === normalizedY) {
          return current;
        }

        const next = new Map(current);
        next.set(id, {
          ...frame,
          x: normalizedX,
          y: normalizedY,
        });
        return next;
      });

      scheduleSnapshotPersist();
    },
    [applyFrames, scheduleSnapshotPersist],
  );

  const handleResizeFrame = useCallback(
    (id: string, nextW: number, nextH: number) => {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;

        if (frame.w === nextW && frame.h === nextH) {
          return current;
        }

        const next = new Map(current);
        next.set(id, {
          ...frame,
          w: nextW,
          h: nextH,
        });
        return next;
      });

      scheduleSnapshotPersist();
    },
    [applyFrames, scheduleSnapshotPersist],
  );

  const handleTransformChange = useCallback(
    (nextTransform: Transform) => {
      canvasTransformRef.current = nextTransform;
      setCanvasTransform(nextTransform);
      scheduleSnapshotPersist();
    },
    [scheduleSnapshotPersist],
  );

  function handleMenuClick(action: ProjectActionId) {
    switch (action) {
      case "all-projects":
        router.push("/");
        break;
      case "share":
        alert("Share functionality is not implemented yet.");
        break;
      case "download":
        alert("Download functionality is not implemented yet.");
        break;
      case "edit":
        alert("Edit functionality is not implemented yet.");
        break;
      case "delete": {
        const confirmed = confirm(
          "Are you sure you want to delete this project? This action cannot be undone.",
        );
        if (confirmed) {
          deleteProject({ id: projectId });
        }
        break;
      }
      case "feedback": {
        setOpenFeedbackForm(true);
        break;
      }
      default:
        alert("Unknown action: " + action);
        break;
    }
  }

  const handleFrame = useCallback(
    async (id: string) => {
      if (!project) {
        logger.error("Project not found");
        return;
      }

      if (isGenerating) {
        logger.warn(
          "Frame regenerate blocked while full generation is active",
          {
            frameId: id,
          },
        );
        toast.error(
          "Please wait for the current generation to finish before regenerating individual frames.",
        );
        return;
      }

      const sourceFrame = framesRef.current.get(id);
      if (!sourceFrame) {
        logger.warn("Clicked frame not found", { frameId: id });
        return;
      }

      logger.info("Regenerate frame requested", {
        frameId: id,
        generationId: sourceFrame.generationId,
      });

      const frameRegenerationToken = frameRegenerationTokenRef.current + 1;
      frameRegenerationTokenRef.current = frameRegenerationToken;
      const isStaleFrameRegeneration = () =>
        frameRegenerationToken !== frameRegenerationTokenRef.current;

      const promptOverride = prompt.trim();
      const hasPromptOverride = promptOverride.length > 0;
      const sourceContent = sourceFrame.content;
      const sourceEditedContent = sourceFrame.editedContent;

      let resolvedGenerationId = sourceFrame.generationId;
      let streamedContent = "";
      let bufferedChunk = "";
      let hasMeaningfulStream = false;
      let terminalEventReceived = false;
      let streamFailed = false;
      let chunkFlushInterval: ReturnType<typeof setInterval> | null = null;

      const stopChunkFlush = () => {
        if (!chunkFlushInterval) return;
        clearInterval(chunkFlushInterval);
        chunkFlushInterval = null;
      };

      const flushChunk = () => {
        if (!bufferedChunk) return;

        streamedContent += bufferedChunk;
        bufferedChunk = "";

        applyFrames((current) => {
          const frame = current.get(id);
          if (!frame) return current;

          const next = new Map(current);
          next.set(id, {
            ...frame,
            generationId: resolvedGenerationId,
            state: "streaming",
            content: streamedContent,
            editedContent: null,
            error: null,
          });
          return next;
        });
      };

      const applyFallbackError = (message: string) => {
        applyFrames((current) => {
          const frame = current.get(id);
          if (!frame) return current;

          const fallbackContent = hasMeaningfulStream
            ? streamedContent || sourceContent
            : sourceContent;

          const next = new Map(current);
          next.set(id, {
            ...frame,
            generationId: resolvedGenerationId,
            state: "error",
            content: fallbackContent,
            editedContent: hasMeaningfulStream ? null : sourceEditedContent,
            error: message,
          });
          return next;
        });
      };

      const finalizeFromStream = () => {
        const hasRenderableContent = streamedContent.trim().length > 0;
        const nextState: FrameState = hasRenderableContent ? "done" : "error";
        const nextError = hasRenderableContent
          ? null
          : "Generation ended before this frame completed.";
        const nextContent = hasRenderableContent
          ? streamedContent
          : sourceContent;

        applyFrames((current) => {
          const frame = current.get(id);
          if (!frame) return current;

          const next = new Map(current);
          next.set(id, {
            ...frame,
            generationId: resolvedGenerationId,
            state: nextState,
            content: nextContent,
            editedContent: hasRenderableContent ? null : sourceEditedContent,
            error: nextError,
          });
          return next;
        });
      };

      try {
        applyFrames((current) => {
          const frame = current.get(id);
          if (!frame) return current;

          const next = new Map(current);
          next.set(id, {
            ...frame,
            state: "skeleton",
            error: null,
          });
          return next;
        });

        const response = await fetch(`/api/generate/${id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(hasPromptOverride
              ? { "Idempotency-Key": crypto.randomUUID() }
              : {}),
          },
          body: JSON.stringify({
            projectId: project.id,
            generationId: sourceFrame.generationId,
            model,
            ...(hasPromptOverride ? { prompt: promptOverride } : {}),
          }),
        });

        if (!response.ok || !response.body) {
          const errorMessage = await readResponseErrorMessage(response);
          throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        const processSseLines = (lines: string[]) => {
          for (const line of lines) {
            if (isStaleFrameRegeneration()) {
              return true;
            }

            if (!line.startsWith("data:")) continue;

            const raw = line.slice(5).trim();
            if (!raw) continue;

            if (raw === "[DONE]") {
              return true;
            }

            try {
              const event = JSON.parse(raw) as FrameGenerationEvent;

              if (event.type === "generation_id") {
                resolvedGenerationId = event.generationId;
                continue;
              }

              if (event.type === "frame_start") {
                applyFrames((current) => {
                  const frame = current.get(id);
                  if (!frame) return current;

                  const next = new Map(current);
                  next.set(id, {
                    ...frame,
                    generationId: resolvedGenerationId,
                    state: "streaming",
                    content: "",
                    editedContent: null,
                    error: null,
                  });
                  return next;
                });
                continue;
              }

              if (event.type === "frame_reset") {
                bufferedChunk = "";
                streamedContent = "";
                hasMeaningfulStream = false;

                applyFrames((current) => {
                  const frame = current.get(id);
                  if (!frame) return current;

                  const next = new Map(current);
                  next.set(id, {
                    ...frame,
                    generationId: resolvedGenerationId,
                    state: "streaming",
                    content: "",
                    editedContent: null,
                    error: null,
                  });
                  return next;
                });
                continue;
              }

              if (event.type === "code_chunk") {
                bufferedChunk += event.token;
                if (event.token.trim()) {
                  hasMeaningfulStream = true;
                }
                if (!chunkFlushInterval) {
                  chunkFlushInterval = setInterval(flushChunk, CHUNK_FLUSH_MS);
                }
                continue;
              }

              if (event.type === "frame_done") {
                flushChunk();
                continue;
              }

              if (event.type === "done") {
                terminalEventReceived = true;
                flushChunk();
                finalizeFromStream();
                return true;
              }

              if (event.type === "error") {
                terminalEventReceived = true;
                flushChunk();
                applyFallbackError(event.message);
                return true;
              }
            } catch (parseError) {
              logger.warn("Skipping malformed frame SSE payload", {
                rawSnippet: raw.slice(0, 200),
                parseError,
              });
            }
          }

          return false;
        };

        while (true) {
          if (isStaleFrameRegeneration()) {
            stopChunkFlush();
            return;
          }

          const { done, value } = await reader.read();

          if (isStaleFrameRegeneration()) {
            stopChunkFlush();
            return;
          }

          if (value) {
            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split(/\r?\n/);
            sseBuffer = lines.pop() ?? "";

            if (processSseLines(lines)) {
              stopChunkFlush();
              return;
            }
          }

          if (done) {
            sseBuffer += decoder.decode();

            if (sseBuffer) {
              if (processSseLines(sseBuffer.split(/\r?\n/))) {
                stopChunkFlush();
                return;
              }
            }

            break;
          }
        }
      } catch (error) {
        if (isStaleFrameRegeneration()) {
          return;
        }

        streamFailed = true;
        applyFallbackError(
          error instanceof Error
            ? error.message
            : "Frame regeneration failed unexpectedly.",
        );
        logger.error("Error regenerating frame:", error);
      } finally {
        stopChunkFlush();

        if (isStaleFrameRegeneration()) {
          return;
        }

        if (!streamFailed && !terminalEventReceived) {
          flushChunk();
          finalizeFromStream();
        }

        setActiveGenerationContext(resolvedGenerationId);
        scheduleSnapshotPersist(resolvedGenerationId);
      }
    },
    [
      applyFrames,
      isGenerating,
      model,
      project,
      prompt,
      scheduleSnapshotPersist,
      setActiveGenerationContext,
    ],
  );

  useEffect(() => {
    if (projectLoading || isError) return;

    if (!project) {
      logger.error("Project not found");
      return;
    }

    hydrateStudioState(project);

    const fallbackSelectedGenerationId =
      project.generations[project.generations.length - 1]?.generationId ?? null;

    const canvasSnapshot = project.canvasState
      ? ({
          ...project.canvasState,
          selectedGenerationId:
            project.canvasState.selectedGenerationId ??
            fallbackSelectedGenerationId,
          frames: project.frames,
        } as CanvasSnapshotV1)
      : project.frames.length > 0
        ? ({
            version: 1,
            camera: { x: 0, y: 0, k: 1 },
            activeFrameId: null,
            selectedFrameId: null,
            selectedGenerationId: fallbackSelectedGenerationId,
            savedAt: new Date().toISOString(),
            frames: project.frames,
          } as CanvasSnapshotV1)
        : null;

    if (!hasHydratedCanvas) {
      if (canvasSnapshot) {
        restoreFromSnapshot(canvasSnapshot);
        setActiveGenerationContext(canvasSnapshot.selectedGenerationId);
      }
      setRuntimeHydrated(true);
    }

    if (
      project.frames.length === 0 &&
      !hasInitiatedGeneration &&
      project.status !== "ARCHIVED"
    ) {
      setRuntimeInitiatedGeneration(true);
      void handleGenerate();
    }
  }, [
    hasHydratedCanvas,
    hasInitiatedGeneration,
    handleGenerate,
    hydrateStudioState,
    isError,
    project,
    projectError,
    projectLoading,
    restoreFromSnapshot,
    setActiveGenerationContext,
    setRuntimeHydrated,
    setRuntimeInitiatedGeneration,
  ]);

  useEffect(() => {
    if (deleteProjectData?.error === false) {
      logger.info("Project deleted successfully:", deleteProjectData);
      router.push("/");
    }
  }, [deleteProjectData, deleteError, router, isDeleteSuccess]);

  useEffect(() => {
    return () => {
      stopChunkFlusher();
      flushPendingSnapshotPersist();

      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }

      if (snapshotSaveTimeoutRef.current) {
        clearTimeout(snapshotSaveTimeoutRef.current);
        snapshotSaveTimeoutRef.current = null;
      }
    };
  }, [flushPendingSnapshotPersist, stopChunkFlusher]);

  useEffect(() => {
    const promptInput = commandInputRef.current;

    if (!promptInput) {
      return;
    }

    promptInput.style.height = "0px";
    const nextHeight = Math.min(promptInput.scrollHeight, MAX_PROMPT_HEIGHT);
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY =
      promptInput.scrollHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, [prompt]);

  if (projectLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div
          className={cn("text-xs uppercase tracking-[0.2em]", mono.className)}
        >
          Loading project...
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = getSafeErrorMessage(
      projectError,
      "Failed to load this project.",
    );

    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
          <h1
            className={cn(
              "text-sm uppercase tracking-[0.18em]",
              mono.className,
            )}
          >
            Unable to load project
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{errorMessage}</p>

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={() => void refetchProject()} variant="secondary">
              Retry
            </Button>
            <Button onClick={() => router.push("/")} variant="ghost">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
          <h1
            className={cn(
              "text-sm uppercase tracking-[0.18em]",
              mono.className,
            )}
          >
            Project not found
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This project may have been deleted or you no longer have access.
          </p>

          <div className="mt-5">
            <Button onClick={() => router.push("/")} variant="secondary">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "dark relative h-screen w-full overflow-hidden bg-background text-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "[--radius:2px] [--background:#111111] [--foreground:#e2e2e2]",
        "[--card:#1a1a1a] [--card-foreground:#e2e2e2] [--popover:#1a1a1a] [--popover-foreground:#f9f9f9]",
        "[--primary:#ffffff] [--primary-foreground:#000000] [--secondary:#1a1a1a] [--secondary-foreground:#f1f1f1]",
        "[--muted:#1a1a1a] [--muted-foreground:#777777] [--accent:#222222] [--accent-foreground:#f9f9f9]",
        "[--destructive:#ba1a1a] [--border:#222222] [--input:#333333] [--ring:#777777]",
      )}
    >
      <div className="absolute inset-0 z-40" ref={domRef}>
        <InfiniteCanvas
          ref={canvasRef}
          frames={frameRects}
          activeFrameId={activeFrameId}
          onFrameExit={exitFrame}
          onTransformChange={handleTransformChange}
        >
          <SandpackProvider>
            {frameList.map((frame) => (
              <CanvasFrame
                {...frame}
                key={frame.id}
                scale={canvasTransform.k}
                isActive={activeFrameId === frame.id}
                isSelected={selectedFrameId === frame.id}
                onSelect={(id) => {
                  setSelectedFrameId(id);
                  selectedFrameIdRef.current = id;
                  const frame = framesRef.current.get(id);
                  if (frame) {
                    setStudioSelectedGenerationId(frame.generationId);
                  }
                }}
                onActivate={(id) => {
                  setSelectedFrameId(id);
                  enterFrame(id);
                  selectedFrameIdRef.current = id;
                  activeFrameIdRef.current = id;
                  const frame = framesRef.current.get(id);
                  if (frame) {
                    setStudioSelectedGenerationId(frame.generationId);
                  }
                  scheduleSnapshotPersist();
                }}
                onMove={handleMoveFrame}
                onResize={handleResizeFrame}
                handleFrame={handleFrame}
              />
            ))}
          </SandpackProvider>
        </InfiniteCanvas>
      </div>

      <ProjectMenuPanel
        title={project.title || "Untitled Project"}
        handleMenuClick={handleMenuClick}
      />

      <FeedbackForm
        open={openFeedbackForm}
        onOpenChange={setOpenFeedbackForm}
      />

      <div className="pointer-events-none absolute inset-0 z-50">
        <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(980px,calc(100%-1.5rem))] -translate-x-1/2 rounded-md border border-input bg-card/90 p-2.5 shadow-2xl shadow-black/30 backdrop-blur-[1px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 border border-input bg-muted p-1">
              <Button
                type="button"
                size="xs"
                variant={spec === "web" ? "secondary" : "ghost"}
                onClick={() => setSpec("web")}
                className={cn(
                  "h-7 px-2",
                  spec === "mobile" && "text-muted-foreground",
                )}
              >
                <Monitor data-icon="inline-start" className="size-4" />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.18em]",
                    mono.className,
                  )}
                >
                  Web
                </span>
              </Button>
              <Button
                type="button"
                size="xs"
                variant={spec === "mobile" ? "secondary" : "ghost"}
                onClick={() => setSpec("mobile")}
                className={cn(
                  "h-7 px-2",
                  spec === "web" && "text-muted-foreground",
                )}
              >
                <Smartphone data-icon="inline-start" className="size-4" />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.18em]",
                    mono.className,
                  )}
                >
                  Mobile
                </span>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {isGenerating && (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground",
                    mono.className,
                  )}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  {activeStreamingScreen
                    ? `Generating: ${activeStreamingScreen}`
                    : "Preparing generation..."}
                </span>
              )}
              {canvasSaveMessage && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200",
                    mono.className,
                  )}
                >
                  {canvasSaveMessage}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                Use Enter to generate and Shift+Enter for a new line
              </span>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <SelectModel list={models} setModel={setModel} model={model} />

            <textarea
              ref={commandInputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canGenerate) {
                    void handleGenerate();
                  }
                }
              }}
              placeholder="What would you like to change or create?"
              className={cn(
                "scrolling flex-1 resize-none rounded-md border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition",
                "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30",
                isGenerating && "cursor-not-allowed opacity-80",
                mono.className,
              )}
            />

            <Button
              onClick={() => handleGenerate()}
              disabled={!canGenerate}
              className="h-11 rounded-md px-4"
            >
              <Sparkles
                className={`size-4 ${isGenerating ? "animate-spin" : ""}`}
              />
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectStudioClient;
