"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ProjectMenuPanel from "@/components/projects/TopMenu";
import {
  useProjectCanvasStateUpdateMutation,
  useProjectDeleteMutation,
  useProjectMetadataUpdateMutation,
  useProjectQuery,
  useProjectStatusUpdateMutation,
  useProjectThumbnailUpdateMutation,
} from "@/lib/projects/queries";
import {
  useProjectStudioStore,
  useProjectStudioStoreApi,
} from "@/providers/project-studio-provider";
import { useUserActivityStore } from "@/providers/zustand-provider";
import { Check, Code2, Monitor, Smartphone, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectStudioRuntimeState } from "@/stores/project-studio";

import { CanvasSnapshotV1, FrameState } from "@/lib/canvas-state";
import {
  getGenerationLayout,
  getInitialDimensionsForPlatform,
  getRegenerationClonePosition,
} from "@/lib/canvasLayout";
import logger from "@/lib/logger";
import { GenerationPlatform, WebAppSpec } from "@/lib/types";
import { cn } from "@/lib/utils";
import FeedbackForm from "./FeedbackForm";
import { toast } from "sonner";
import JSZip from "jszip";
import * as htmlToImage from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  | "export-png"
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

function cloneFrameForRegeneration(
  sourceFrame: CanvasFrameData,
  targetFrameId: string,
  existingFrames: CanvasFrameData[],
): CanvasFrameData {
  const { x, y } = getRegenerationClonePosition(existingFrames, sourceFrame);

  return {
    ...sourceFrame,
    id: targetFrameId,
    x: normalizePosition(x),
    y: normalizePosition(y),
    state: "skeleton",
    editedContent: null,
    error: null,
  };
}

function slugifyFileName(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const { mutateAsync: updateProjectMetadata, isPending: isSavingMetadata } =
    useProjectMetadataUpdateMutation();

  const model = useUserActivityStore((state) => state.model);
  // const setModel = useUserActivityStore((state) => state.setModel);
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

  const studio = projectStudioStoreApi.getState().studio;

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
  const [generationMode, setGenerationMode] = useState<
    "generate" | "regenerate"
  >("generate");
  const regenFrameIdRef = useRef<string | null>(null);
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
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [codeEditorOpen, setCodeEditorOpen] = useState(false);
  const [codeEditorValue, setCodeEditorValue] = useState("");
  const [generationRecoveryPrompt, setGenerationRecoveryPrompt] = useState<
    string | null
  >(null);
  const [generationErrorMessage, setGenerationErrorMessage] = useState<
    string | null
  >(null);
  const handleGenerateRef = useRef<() => Promise<void>>(async () => {});

  const {
    activeFrameId,
    selectedFrameId,
    setSelectedFrameId,
    enterFrame,
    exitFrame,
    openEditor,
    closeEditor,
  } = usePointerMode();

  const canGenerate = !!prompt.trim() && !isGenerating;

  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

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
    (generationId?: string, options: { allowEmpty?: boolean } = {}) => {
      if (!projectId || !getStudioRuntime().hasHydratedCanvas) return;

      if (snapshotSaveTimeoutRef.current) {
        clearTimeout(snapshotSaveTimeoutRef.current);
      }

      const resolvedGenerationId = resolvePersistGenerationId(generationId);

      snapshotSaveTimeoutRef.current = setTimeout(() => {
        snapshotSaveTimeoutRef.current = null;
        const snapshot = buildSnapshot();
        if (snapshot.frames.length === 0 && !options.allowEmpty) {
          // Don't persist empty canvas state as it can overwrite existing state with an empty one in case of a delayed persist call after a new generation has started.
          return;
        }
        persistCanvasState({
          id: projectId,
          canvasState: snapshot,
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
    if (isUploadingThumbnailRef.current) {
      return;
    }

    isUploadingThumbnailRef.current = true;
    try {
      const url = new URL(
        `/projects/${projectId}`,
        window.location.origin,
      ).toString();

      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, url }),
      });

      if (!response.ok) {
        throw new Error(await readResponseErrorMessage(response));
      }

      const thumbnailBlob = await response.blob();
      if (thumbnailBlob.size === 0) {
        throw new Error("Capture API returned an empty screenshot.");
      }

      await updateProjectThumbnail({
        id: projectId,
        thumbnail: thumbnailBlob,
      });
      logger.info("Project thumbnail updated via Puppeteer.", { projectId });
    } catch (error) {
      logger.error("Failed to capture and upload project thumbnail:", error);
      toast.error("Thumbnail capture failed", {
        description:
          error instanceof Error
            ? error.message
            : "The project preview could not be captured.",
      });
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

  const handleEvent = (event: GenerationEvent, generationToken: number) => {
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

      // Focus canvas on regenerated frame
      if (regenFrameIdRef.current && frameId === regenFrameIdRef.current) {
        const regenFrame = framesRef.current.get(regenFrameIdRef.current);
        if (regenFrame) {
          setSelectedFrameId(frameId);
          selectedFrameIdRef.current = frameId;
          enterFrame(frameId);
          activeFrameIdRef.current = frameId;

          requestAnimationFrame(() => {
            canvasRef.current?.zoomToRect(
              {
                x: regenFrame.x,
                y: regenFrame.y,
                w: regenFrame.w,
                h: regenFrame.h,
              },
              40,
            );
          });
        }
      }

      scheduleSnapshotPersist(generationId);
      return;
    }

    if (event.type === "done") {
      finalizePendingFrames({ preferError: false });

      updateProjectStatus({ id: projectId, status: "ACTIVE" });

      const allRects = toFrameRects([...framesRef.current.values()]);
      if (regenFrameIdRef.current) {
        const focusFrame = framesRef.current.get(regenFrameIdRef.current);
        if (focusFrame) {
          setSelectedFrameId(focusFrame.id);
          selectedFrameIdRef.current = focusFrame.id;
          enterFrame(focusFrame.id);
          activeFrameIdRef.current = focusFrame.id;

          requestAnimationFrame(() => {
            canvasRef.current?.zoomToRect(
              {
                x: focusFrame.x,
                y: focusFrame.y,
                w: focusFrame.w,
                h: focusFrame.h,
              },
              40,
            );
          });
        }
        regenFrameIdRef.current = null;
      } else if (allRects.length > 0) {
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
  };

  const handleGenerate = async () => {
    if (!project) {
      logger.error("Project not found");
      return;
    }

    const generationPrompt =
      project.status === "PENDING"
        ? project.initialPrompt
        : prompt.trim() || project.initialPrompt;

    const generationToken = beginGenerationRun(crypto.randomUUID());
    const isStaleGeneration = () =>
      generationToken !== getStudioRuntime().generationToken;

    setIsGenerating(true);
    setActiveStreamingScreen(null);
    setGenerationErrorMessage(null);
    setGenerationRecoveryPrompt(null);

    let terminalEventReceived = false;
    let streamFailed = false;
    let regenerationTargetFrameId: string | null = null;
    let sourceFrame: CanvasFrameData | null = null;

    try {
      stopChunkFlusher();
      if (activeFrameId) {
        sourceFrame = framesRef.current.get(activeFrameId) ?? null;
      }

      let generationId = "";
      if (activeFrameId) {
        generationId = sourceFrame?.generationId ?? "";
        if (!generationId) {
          throw new Error("Unable to find generation ID for active frame.");
        }
      }

      const isFrameRegeneration =
        generationMode === "regenerate" && !!activeFrameId && !!sourceFrame;

      if (generationMode === "regenerate" && activeFrameId && !sourceFrame) {
        throw new Error("Unable to find source frame for regeneration.");
      }

      if (isFrameRegeneration && sourceFrame) {
        const regenerationSourceFrame = sourceFrame;
        regenerationTargetFrameId = crypto.randomUUID();
        regenFrameIdRef.current = regenerationTargetFrameId;

        const clonedFrame = cloneFrameForRegeneration(
          regenerationSourceFrame,
          regenerationTargetFrameId,
          [...framesRef.current.values()],
        );

        applyFrames((current) => {
          const next = new Map(current);
          next.set(regenerationTargetFrameId!, clonedFrame);
          return next;
        });

        updateStudioRuntime((runtime) => {
          const nextFrameIdsByScreen = new Map(runtime.frameIdsByScreen);
          nextFrameIdsByScreen.set(regenerationSourceFrame.screenName, [
            regenerationTargetFrameId!,
          ]);

          const nextActiveFrameIdsByScreen = new Map(
            runtime.activeFrameIdsByScreen,
          );
          nextActiveFrameIdsByScreen.set(
            regenerationSourceFrame.screenName,
            regenerationTargetFrameId!,
          );

          return {
            ...runtime,
            frameIdsByScreen: nextFrameIdsByScreen,
            activeFrameIdsByScreen: nextActiveFrameIdsByScreen,
          };
        });
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          projectId: project.id,
          generationId: generationId ?? "",
          frameId:
            isFrameRegeneration && sourceFrame ? sourceFrame.id : undefined,
          targetFrameId: regenerationTargetFrameId ?? undefined,
          model,
          prompt: generationPrompt,
          platform: spec ?? "web",
        }),
      });

      setPrompt("");

      if (!response.ok || !response.body) {
        const errorMessage = await readResponseErrorMessage(response);
        if (response.status === 402) {
          toast.error("Generation quota reached", {
            description: errorMessage,
            action: {
              label: "Upgrade",
              onClick: () => router.push("/billing/upgrade"),
            },
          });
        }
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
      const message =
        error instanceof Error
          ? error.message
          : "Generation failed unexpectedly.";
      if (regenerationTargetFrameId) {
        applyFrames((current) => {
          const frame = current.get(regenerationTargetFrameId!);
          if (!frame) return current;

          const next = new Map(current);
          next.set(regenerationTargetFrameId!, {
            ...frame,
            state: "error",
            error: message,
          });
          return next;
        });
      }

      setGenerationErrorMessage(message);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setGenerationRecoveryPrompt(generationPrompt);
      }
      finalizePendingFrames({
        preferError: true,
        errorMessage: message,
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
      regenerationTargetFrameId = null;
    }
  };

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

  const handleShareProject = useCallback(async () => {
    const shareUrl = `${window.location.origin}/projects/${projectId}`;

    try {
      await copyTextToClipboard(shareUrl);
      toast.success("Link copied to clipboard", {
        description:
          "This project is private. Anyone opening the link must have access to this account until public sharing is supported.",
      });
    } catch (error) {
      logger.error("Failed to copy project link", error);
      toast.error("Could not copy the project link.");
    }
  }, [projectId]);

  const handleDownloadProject = useCallback(async () => {
    const doneFrames = [...framesRef.current.values()].filter(
      (frame) =>
        frame.state === "done" && (frame.editedContent ?? frame.content),
    );

    if (doneFrames.length === 0) {
      toast.error("No completed frames to download yet.");
      return;
    }

    try {
      const zip = new JSZip();
      const src = zip.folder("src");
      const screens = src?.folder("screens");
      const fileNames = new Map<string, string>();

      doneFrames.forEach((frame, index) => {
        const baseName = slugifyFileName(
          frame.screenName,
          `screen-${index + 1}`,
        );
        let fileName = `${baseName}.tsx`;
        let suffix = 2;
        while (fileNames.has(fileName)) {
          fileName = `${baseName}-${suffix}.tsx`;
          suffix += 1;
        }
        fileNames.set(fileName, frame.id);
        screens?.file(fileName, frame.editedContent ?? frame.content);
      });

      const imports = [...fileNames.keys()]
        .map((fileName, index) => {
          const componentName = `Screen${index + 1}`;
          return `import ${componentName} from "./screens/${fileName.replace(/\.tsx$/, "")}";`;
        })
        .join("\n");

      const navItems = doneFrames
        .map(
          (frame, index) =>
            `{ id: "screen-${index + 1}", label: ${JSON.stringify(frame.screenName)}, Component: Screen${index + 1} }`,
        )
        .join(",\n  ");

      src?.file(
        "App.tsx",
        `${imports}

const screens = [
  ${navItems}
];

export default function App() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <nav className="sticky top-0 z-10 flex gap-2 border-b border-white/10 bg-neutral-950/90 px-4 py-3 backdrop-blur">
        {screens.map((screen) => (
          <a key={screen.id} href={\`#\${screen.id}\`} className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-white/10 hover:text-white">
            {screen.label}
          </a>
        ))}
      </nav>
      <div className="space-y-8 p-4">
        {screens.map(({ id, Component }) => (
          <section key={id} id={id} className="overflow-hidden rounded-lg border border-white/10 bg-white">
            <Component />
          </section>
        ))}
      </div>
    </main>
  );
}
`,
      );

      src?.file(
        "main.tsx",
        `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      );

      src?.file(
        "styles.css",
        `@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}
`,
      );

      zip.file(
        "package.json",
        JSON.stringify(
          {
            scripts: {
              dev: "vite --host 0.0.0.0",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              "@vitejs/plugin-react": "^5.0.0",
              vite: "^7.0.0",
              typescript: "^5.0.0",
              react: "19.2.4",
              "react-dom": "19.2.4",
              "lucide-react": "^0.577.0",
              recharts: "^2.10.0",
              clsx: "^2.1.1",
              "tailwind-merge": "^3.5.0",
              "date-fns": "^3.6.0",
              dayjs: "^1.11.0",
              lodash: "^4.17.21",
              tailwindcss: "^3.4.17",
              autoprefixer: "^10.4.20",
              postcss: "^8.4.49",
            },
            devDependencies: {},
          },
          null,
          2,
        ),
      );
      zip.file(
        "index.html",
        '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
      );
      zip.file(
        "tailwind.config.js",
        `export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
      );
      zip.file(
        "postcss.config.js",
        `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      );
      zip.file(
        "README.md",
        `# ${project?.title || "LOGIC export"}

Generated from LOGIC. Run:

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(
        blob,
        `${slugifyFileName(project?.title || "logic-project", "logic-project")}.zip`,
      );
      toast.success("Project source downloaded");
    } catch (error) {
      logger.error("Project download failed", error);
      toast.error("Could not package this project.");
    }
  }, [project?.title]);

  const handleExportPng = useCallback(async () => {
    const world = document.querySelector<HTMLElement>(
      '[data-canvas-capture="world"]',
    );

    if (!world || framesRef.current.size === 0) {
      toast.error("No canvas frames to export.");
      return;
    }

    const placeholders: HTMLDivElement[] = [];

    try {
      world.querySelectorAll("iframe").forEach((iframe) => {
        const parent = iframe.parentElement;
        if (!parent) return;

        const placeholder = document.createElement("div");
        placeholder.textContent = "Preview iframe";
        placeholder.style.position = "absolute";
        placeholder.style.left = iframe.style.left || "0";
        placeholder.style.top = iframe.style.top || "0";
        placeholder.style.width = iframe.style.width || "100%";
        placeholder.style.height = iframe.style.height || "100%";
        placeholder.style.zIndex = "3";
        placeholder.style.display = "flex";
        placeholder.style.alignItems = "center";
        placeholder.style.justifyContent = "center";
        placeholder.style.background = "#f4f4f5";
        placeholder.style.color = "#52525b";
        placeholder.style.font = "600 12px system-ui";
        placeholder.style.border = "1px solid rgba(0,0,0,0.08)";
        parent.appendChild(placeholder);
        placeholders.push(placeholder);
      });

      const blob = await htmlToImage.toBlob(world, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#111111",
      });

      if (!blob) throw new Error("PNG export returned an empty blob.");

      triggerBlobDownload(
        blob,
        `${slugifyFileName(project?.title || "logic-canvas", "logic-canvas")}.png`,
      );
      toast.success("Canvas PNG exported", {
        description:
          "Iframe previews are represented with placeholders in browser exports.",
      });
    } catch (error) {
      logger.error("PNG export failed", error);
      toast.error("Could not export the canvas as PNG.");
    } finally {
      placeholders.forEach((placeholder) => placeholder.remove());
    }
  }, [project?.title]);

  const openMetadataEditor = useCallback(() => {
    setMetadataTitle(project?.title || "Untitled Project");
    setMetadataDescription(project?.description || "");
    setMetadataDialogOpen(true);
  }, [project?.description, project?.title]);

  const saveProjectMetadata = useCallback(async () => {
    const title = metadataTitle.trim();
    if (!title) {
      toast.error("Project title is required.");
      return;
    }

    try {
      await updateProjectMetadata({
        id: projectId,
        title,
        description: metadataDescription.trim(),
      });
      toast.success("Project details updated");
      setMetadataDialogOpen(false);
    } catch (error) {
      logger.error("Project metadata update failed", error);
      toast.error("Could not update project details.");
    }
  }, [metadataDescription, metadataTitle, projectId, updateProjectMetadata]);

  const handleOpenCodeEditor = useCallback(
    (frameId: string) => {
      const frame = framesRef.current.get(frameId);
      if (!frame) return;

      setSelectedFrameId(frameId);
      selectedFrameIdRef.current = frameId;
      setCodeEditorValue(frame.editedContent ?? frame.content);
      setCodeEditorOpen(true);
      openEditor(frameId);
    },
    [openEditor, setSelectedFrameId],
  );

  const handleSaveCodeEditor = useCallback(() => {
    if (!activeFrameId) return;

    const generationId = framesRef.current.get(activeFrameId)?.generationId;

    applyFrames((current) => {
      const frame = current.get(activeFrameId);
      if (!frame) return current;

      const next = new Map(current);
      next.set(activeFrameId, {
        ...frame,
        state: "done",
        editedContent: codeEditorValue,
        error: null,
      });
      return next;
    });

    scheduleSnapshotPersist(generationId);
    setCodeEditorOpen(false);
    closeEditor();
    toast.success("Frame code updated");
  }, [
    activeFrameId,
    applyFrames,
    closeEditor,
    codeEditorValue,
    scheduleSnapshotPersist,
  ]);

  const handleCloseCodeEditor = useCallback(
    (open: boolean) => {
      setCodeEditorOpen(open);
      if (!open) closeEditor();
    },
    [closeEditor],
  );

  function handleMenuClick(action: ProjectActionId) {
    switch (action) {
      case "all-projects":
        router.push("/");
        break;
      case "share":
        void handleShareProject();
        break;
      case "download":
        void handleDownloadProject();
        break;
      case "export-png":
        void handleExportPng();
        break;
      case "edit":
        openMetadataEditor();
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
        toast.error("Unknown action: " + action);
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

  const handleDelete = useCallback(
    (frameId: string) => {
      const frameToDelete = framesRef.current.get(frameId);

      applyFrames((current) => {
        const frame = current.get(frameId);
        if (!frame) return current;
        const next = new Map(current);
        next.delete(frameId);
        return next;
      });

      updateStudioRuntime((runtime) => {
        const nextFrameIdsByScreen = new Map(runtime.frameIdsByScreen);
        const screenName = frameToDelete?.screenName;
        if (screenName) {
          const frameIds = nextFrameIdsByScreen.get(screenName) ?? [];
          nextFrameIdsByScreen.set(
            screenName,
            frameIds.filter((id) => id !== frameId),
          );
        }
        return {
          ...runtime,
          frameIdsByScreen: nextFrameIdsByScreen,
          activeFrameIdsByScreen: new Map(
            [...runtime.activeFrameIdsByScreen.entries()].filter(
              ([, id]) => id !== frameId,
            ),
          ),
        };
      });
      scheduleSnapshotPersist(frameToDelete?.generationId, {
        allowEmpty: true,
      });
    },
    [applyFrames, scheduleSnapshotPersist, updateStudioRuntime],
  );

  useEffect(() => {
    if (!generationRecoveryPrompt) return;

    const handleOnline = () => {
      toast.info("Connection restored", {
        description: "You can resume the interrupted generation.",
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [generationRecoveryPrompt]);

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
      void handleGenerateRef.current();
    }
  }, [
    hasHydratedCanvas,
    hasInitiatedGeneration,
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
          {/* <SandpackProvider> */}
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
                // onCapture();
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
              handleDelete={handleDelete}
              handleEditCode={handleOpenCodeEditor}
            />
          ))}
          {/* </SandpackProvider> */}
        </InfiniteCanvas>

        {frameList.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto w-[min(420px,calc(100%-2rem))] rounded-lg border border-white/10 bg-[#181818]/95 p-6 text-center shadow-2xl shadow-black/40">
              <div className="mx-auto flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/5">
                {isGenerating ? (
                  <Sparkles className="size-5 animate-spin text-white/80" />
                ) : (
                  <Code2 className="size-5 text-white/70" />
                )}
              </div>
              <h2 className="mt-4 text-base font-semibold text-white">
                {isGenerating
                  ? "Preparing screens"
                  : "No screens on this canvas"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {isGenerating
                  ? "LOGIC is extracting the app spec and will place preview screens here shortly."
                  : "Use the prompt bar below to generate a new UI, or restore a project from history."}
              </p>
            </div>
          </div>
        )}
      </div>

      <ProjectMenuPanel
        title={project.title || "Untitled Project"}
        handleMenuClick={handleMenuClick}
      />

      <FeedbackForm
        open={openFeedbackForm}
        onOpenChange={setOpenFeedbackForm}
      />

      <Dialog open={metadataDialogOpen} onOpenChange={setMetadataDialogOpen}>
        <DialogContent className="border-white/10 bg-[#181818] text-white">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update how this project appears in your dashboard and sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                value={metadataTitle}
                onChange={(event) => setMetadataTitle(event.target.value)}
                className="bg-black/20"
                maxLength={120}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={metadataDescription}
                onChange={(event) => setMetadataDescription(event.target.value)}
                className="min-h-28 bg-black/20"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMetadataDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveProjectMetadata()}
              disabled={isSavingMetadata}
            >
              <Check className="size-4" />
              {isSavingMetadata ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        direction="right"
        open={codeEditorOpen}
        // onOpenChange={handleCloseCodeEditor}
      >
        <DrawerContent className="min-w-3xl border-white/10 bg-[#111111] text-white">
          <DrawerHeader className="border-b border-white/10">
            <DrawerTitle className="flex items-center gap-2 text-white">
              <Code2 className="size-4" />
              Edit generated TSX
            </DrawerTitle>
            <DrawerDescription>
              Changes are saved as an override, so the original generation
              remains recoverable.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <Textarea
              value={codeEditorValue}
              onChange={(event) => setCodeEditorValue(event.target.value)}
              spellCheck={false}
              className={cn(
                "min-h-[calc(100vh-190px)] flex-1 resize-none border-white/10 bg-black/40 font-mono text-xs leading-5 text-white scrollbar",
                mono.className,
              )}
            />
          </div>
          <DrawerFooter className="border-t border-white/10">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCloseCodeEditor(false)}
                className="cursor-pointer"
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveCodeEditor}
                className="cursor-pointer"
              >
                <Check className="size-4" />
                Save code
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Prompt Bar for generations */}
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
              {activeFrameId && (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-border px-2 py-1 text-[10px] text-black bg-white",
                    mono.className,
                  )}
                >
                  Selected Frame:{" "}
                  {studio?.frames.find((f) => f.id === activeFrameId)
                    ?.screenName || "Unnamed"}
                </span>
              )}
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
              {/* <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                Use Enter to generate and Shift+Enter for a new line
              </span> */}
            </div>
          </div>

          {(generationErrorMessage || generationRecoveryPrompt) && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              <span className="line-clamp-2">
                {generationErrorMessage ||
                  "Generation was interrupted before it finished."}
              </span>
              {generationRecoveryPrompt && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    setPrompt(generationRecoveryPrompt);
                    setGenerationRecoveryPrompt(null);
                    setGenerationErrorMessage(null);
                    window.setTimeout(() => void handleGenerate(), 0);
                  }}
                  disabled={isGenerating}
                >
                  Resume generation
                </Button>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* <SelectModel list={models} setModel={setModel} model={model} /> */}

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
              placeholder={
                activeFrameId
                  ? "Enter a prompt to regenerate the selected frame, or leave blank to reuse the original prompt."
                  : "Enter a prompt to generate a new layout, or leave blank to reuse the original prompt."
              }
              className={cn(
                "scrolling flex-1 resize-none rounded-md border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition",
                "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30",
                isGenerating && "cursor-not-allowed opacity-80",
                mono.className,
              )}
            />

            {activeFrameId ? (
              <div className="relative inline-flex">
                <Button
                  onClick={() => handleGenerate()}
                  className="h-11 rounded-md px-4"
                >
                  <Sparkles
                    className={`size-4 ${isGenerating ? "animate-spin" : ""}`}
                  />
                  {isGenerating
                    ? "Generating..."
                    : generationMode === "regenerate"
                      ? "Regenerate"
                      : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -right-8 h-11 rounded-l-none border-l-0 px-2"
                  onClick={() =>
                    setGenerationMode((prev) =>
                      prev === "generate" ? "regenerate" : "generate",
                    )
                  }
                  disabled={isGenerating}
                >
                  <span className="text-[10px] font-medium">
                    {generationMode === "generate" ? "G" : "R"}
                  </span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => handleGenerate()}
                className="h-11 rounded-md px-4"
              >
                <Sparkles
                  className={`size-4 ${isGenerating ? "animate-spin" : ""}`}
                />
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectStudioClient;
