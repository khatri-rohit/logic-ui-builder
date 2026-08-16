"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { InfiniteCanvasHandle } from "@/components/canvas/InfiniteCanvas";
import type { CanvasFrameData } from "@/components/canvas/types";
import type { ProjectDetail, ProjectGeneration } from "@/lib/api/types";
import {
  adaptFrameEvent,
  isTerminalPersistedScreen,
  type FrameGenerationEvent,
  type GenerationEvent,
} from "@/lib/generation/events";
import { createFrame, recoverStalledFrames } from "@/lib/generation/frames";
import { readResponseErrorMessage } from "@/lib/generation/responseError";
import { shouldAutoStartProjectGeneration } from "@/lib/projects/autoStart";
import {
  projectKeys,
  upsertProjectGenerationInDetail,
  useProjectStatusUpdateMutation,
} from "@/lib/projects/queries";
import { isProbablyCompleteScreen } from "@/lib/sandboxFallbackScreen";
import { readDomainSse } from "@/lib/sse/readDomainSse";
import type { GenerationPlatform } from "@/lib/types";
import logger from "@/lib/logger";
import { useProjectStudioStoreApi } from "@/providers/project-studio-provider";

type ApplyFrames = (
  updater: (
    current: Map<string, CanvasFrameData>,
  ) => Map<string, CanvasFrameData>,
  skipHistory?: boolean,
) => void;

type StatusScreen = {
  id: string;
  screenName: string;
  state: CanvasFrameData["state"];
  content: string;
  error: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type UseGenerationSessionOptions = {
  projectId: string;
  project: ProjectDetail | null | undefined;
  platform: GenerationPlatform;
  prompt: string;
  setPrompt: (value: string) => void;
  generationMode: "generate" | "regenerate";
  activeFrameId: string | null;
  applyFrames: ApplyFrames;
  updateEphemeral: (
    updater: (
      current: Map<string, CanvasFrameData>,
    ) => Map<string, CanvasFrameData>,
  ) => void;
  getFramesSnapshot: () => Map<string, CanvasFrameData>;
  scheduleSnapshotPersist: (
    generationId?: string,
    options?: { allowEmpty?: boolean },
  ) => void;
  flushPendingSnapshotPersist: () => void;
  canvasRef: RefObject<InfiniteCanvasHandle | null>;
  onCapture: () => Promise<void>;
  onQuotaExceeded?: (message: string) => void;
};

function isStreamOpen(state: CanvasFrameData["state"]) {
  return state === "skeleton" || state === "streaming";
}

export function useGenerationSession({
  projectId,
  project,
  platform,
  prompt,
  setPrompt,
  generationMode,
  activeFrameId,
  applyFrames,
  updateEphemeral,
  getFramesSnapshot,
  scheduleSnapshotPersist,
  flushPendingSnapshotPersist,
  canvasRef,
  onCapture,
  onQuotaExceeded,
}: UseGenerationSessionOptions) {
  const studioStore = useProjectStudioStoreApi();
  const queryClient = useQueryClient();
  const { mutate: updateProjectStatus } = useProjectStatusUpdateMutation();

  const abortRef = useRef<AbortController | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEventRef = useRef<
    (event: GenerationEvent, token: number) => void
  >(() => {});
  const handleGenerateRef = useRef<() => Promise<void>>(async () => {});
  const hydrateFromStatusRef = useRef<
    (args: {
      generationId: string;
      status: string;
      screens: StatusScreen[];
    }) => void
  >(() => {});

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingScreen, setActiveStreamingScreen] = useState<
    string | null
  >(null);
  const [generationRecoveryPrompt, setGenerationRecoveryPrompt] = useState<
    string | null
  >(null);
  const [generationErrorMessage, setGenerationErrorMessage] = useState<
    string | null
  >(null);

  const runtime = () => studioStore.getState().runtime;

  const startAbort = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  };

  const persistId = (generationId?: string | null) =>
    generationId ??
    runtime().activeGenerationId ??
    studioStore.getState().studio?.selectedGenerationId ??
    undefined;

  const setActiveGenerationContext = (generationId: string | null) => {
    studioStore.getState().updateRuntime((current) => ({
      ...current,
      activeGenerationId: generationId,
    }));
    studioStore.getState().setSelectedGenerationId(generationId);
  };

  const zoomToFitFrames = () => {
    const rects = [...getFramesSnapshot().values()].map((frame) => ({
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    }));
    if (rects.length === 0) return;
    requestAnimationFrame(() => {
      canvasRef.current?.zoomToFit(rects);
    });
  };

  const scheduleCapture = () => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }
    captureTimeoutRef.current = setTimeout(() => {
      void onCapture();
      captureTimeoutRef.current = null;
    }, 8000);
  };

  const emitReviewLog = (reason: string) => {
    const current = runtime();
    if (current.generationLogEmitted || !current.generationRunId) return;

    const generationId = current.activeGenerationId;
    const screens = [...getFramesSnapshot().values()]
      .filter((frame) =>
        generationId ? frame.generationId === generationId : true,
      )
      .map((frame) => ({
        frameId: frame.id,
        screenName: frame.screenName,
        state: frame.state,
        error: frame.error,
        codeLength: frame.content.length,
        code: frame.content,
      }));

    if (screens.length === 0) return;

    studioStore.getState().updateRuntime((value) => ({
      ...value,
      generationLogEmitted: true,
    }));

    logger.info("Generation review payload", {
      projectId,
      runId: current.generationRunId,
      reason,
      generationId,
      screenCount: screens.length,
      screens,
    });
  };

  const syncProjectDetailCache = (generationId?: string | null) => {
    const resolved = persistId(generationId);
    if (!resolved || !project) return;

    const frames = [...getFramesSnapshot().values()].filter(
      (frame) => frame.generationId === resolved,
    );
    if (frames.length === 0) return;

    const existing = project.generations.find(
      (generation: ProjectGeneration) => generation.generationId === resolved,
    );

    queryClient.setQueryData(
      ["projects", projectId],
      (prev: typeof project | undefined) =>
        upsertProjectGenerationInDetail(
          prev,
          {
            generationId: resolved,
            model: existing?.model ?? "unknown",
            platform: frames[0]?.platform ?? project.platform,
            spec: existing?.spec ?? null,
            screens: frames.map((frame) => ({
              id: frame.id,
              state: frame.state,
              x: frame.x,
              y: frame.y,
              w: frame.w,
              h: frame.h,
              screenName: frame.screenName,
              content: frame.content,
              editedContent: frame.editedContent,
              error: frame.error,
            })),
            status: "COMPLETED",
            terminalAt: existing?.terminalAt ?? new Date().toISOString(),
            errorMessage: null,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          "ACTIVE",
        ),
    );
  };

  const markProjectActive = () => {
    updateProjectStatus({ id: projectId, status: "ACTIVE" });
  };

  const finalizePendingFrames = (args?: {
    preferError?: boolean;
    errorMessage?: string;
  }) => {
    const buffers = runtime().screenBuffers;

    applyFrames((current) => {
      const next = new Map(current);
      let changed = false;

      for (const [frameId, frame] of next) {
        if (!isStreamOpen(frame.state)) continue;

        const candidate = buffers[frameId] ?? frame.content;
        const complete = isProbablyCompleteScreen(candidate);
        const nextState = args?.preferError || !complete ? "error" : "done";
        const content = complete ? candidate : frame.content;
        const error =
          nextState === "error"
            ? (args?.errorMessage ??
              frame.error ??
              "Generation did not finish.")
            : null;

        changed = true;
        next.set(frameId, { ...frame, state: nextState, content, error });
      }

      return changed ? next : current;
    });

    studioStore.getState().updateRuntime((current) => ({
      ...current,
      screenBuffers: {},
      activeFrameIdsByScreen: {},
    }));
    setActiveStreamingScreen(null);
  };

  handleEventRef.current = (event, token) => {
    if (token !== runtime().generationToken) return;

    switch (event.type) {
      case "generation_id":
        setActiveGenerationContext(event.generationId);
        if (event.generationId) {
          scheduleSnapshotPersist(event.generationId);
        }
        return;

      case "design_context":
      case "tree":
      case "spec":
      case "quality_warning":
        return;

      case "layout": {
        const generationId = runtime().activeGenerationId;
        const frameIdsByScreen: Record<string, string[]> = {};
        const layoutFrames = event.layout.map((item) => {
          const ids = frameIdsByScreen[item.screen] ?? [];
          ids.push(item.frameId);
          frameIdsByScreen[item.screen] = ids;
          return createFrame({
            id: item.frameId,
            screenName: item.screen,
            platform: event.platform,
            generationId: generationId ?? "",
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            state: "skeleton",
          });
        });

        studioStore.getState().updateRuntime((current) => ({
          ...current,
          frameIdsByScreen,
          activeFrameIdsByScreen: {},
          screenBuffers: {},
        }));

        applyFrames((current) => {
          const next = new Map(current);
          for (const frame of layoutFrames) {
            next.set(frame.id, frame);
          }
          return next;
        });

        zoomToFitFrames();
        if (generationId) {
          scheduleSnapshotPersist(generationId);
        }
        return;
      }

      case "screen_start": {
        studioStore.getState().updateRuntime((current) => ({
          ...current,
          screenBuffers: {
            ...current.screenBuffers,
            [event.frameId]: "",
          },
          activeFrameIdsByScreen: {
            ...current.activeFrameIdsByScreen,
            [event.screen]: event.frameId,
          },
        }));
        setActiveStreamingScreen(event.screen);

        applyFrames((current) => {
          const frame = current.get(event.frameId);
          if (!frame || frame.state === "streaming") return current;
          const next = new Map(current);
          next.set(event.frameId, {
            ...frame,
            state: "streaming",
            error: null,
          });
          return next;
        }, true);
        return;
      }

      case "screen_reset": {
        studioStore.getState().updateRuntime((current) => ({
          ...current,
          screenBuffers: {
            ...current.screenBuffers,
            [event.frameId]: "",
          },
        }));

        applyFrames((current) => {
          const frame = current.get(event.frameId);
          if (!frame) return current;
          const next = new Map(current);
          next.set(event.frameId, {
            ...frame,
            content: "",
            state: "streaming",
            error: null,
          });
          return next;
        }, true);
        return;
      }

      case "code_chunk": {
        studioStore.getState().updateRuntime((current) => ({
          ...current,
          screenBuffers: {
            ...current.screenBuffers,
            [event.frameId]:
              (current.screenBuffers[event.frameId] ?? "") + event.token,
          },
        }));
        return;
      }

      case "screen_done": {
        const currentRuntime = runtime();
        const buffered = currentRuntime.screenBuffers[event.frameId] ?? "";
        const code = event.content ?? buffered;
        const complete = isProbablyCompleteScreen(code);
        const failed = Boolean(event.error) || !complete;
        const nextState = failed ? "error" : "done";
        const nextError = failed
          ? (event.error ?? "Generation did not finish.")
          : null;
        const generationId =
          getFramesSnapshot().get(event.frameId)?.generationId ||
          currentRuntime.activeGenerationId ||
          "";

        studioStore.getState().updateRuntime((current) => {
          const { [event.frameId]: _buffer, ...screenBuffers } =
            current.screenBuffers;
          const activeFrameIdsByScreen = { ...current.activeFrameIdsByScreen };
          if (activeFrameIdsByScreen[event.screen] === event.frameId) {
            delete activeFrameIdsByScreen[event.screen];
          }
          return { ...current, screenBuffers, activeFrameIdsByScreen };
        });

        applyFrames((current) => {
          const existing = current.get(event.frameId);
          const content = complete ? code : existing?.content || "";
          const next = new Map(current);
          next.set(
            event.frameId,
            existing
              ? {
                  ...existing,
                  state: nextState,
                  content,
                  error: nextError,
                }
              : createFrame({
                  id: event.frameId,
                  screenName: event.screen,
                  platform,
                  generationId,
                  x: event.x,
                  y: event.y,
                  w: event.w,
                  h: event.h,
                  state: nextState,
                  content,
                  error: nextError,
                }),
          );
          return next;
        });

        setActiveStreamingScreen((current) =>
          current === event.screen ? null : current,
        );
        if (generationId) {
          scheduleSnapshotPersist(generationId);
        }
        return;
      }

      case "done": {
        finalizePendingFrames();
        markProjectActive();
        syncProjectDetailCache();
        void queryClient.invalidateQueries({
          queryKey: ["projects", projectId],
        });
        void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
        zoomToFitFrames();
        scheduleCapture();
        emitReviewLog("done");
        scheduleSnapshotPersist(persistId());
        return;
      }

      case "error": {
        logger.error("Generation error event received:", {
          message: event.message,
        });
        finalizePendingFrames({
          preferError: true,
          errorMessage: event.message,
        });
        markProjectActive();
        emitReviewLog("error");
        scheduleSnapshotPersist(persistId());
        return;
      }
    }
  };

  const endBusyIfCurrent = (token: number) => {
    if (token !== runtime().generationToken) return;
    setIsGenerating(false);
    setActiveStreamingScreen(null);
  };

  const hydrateFromStatus = (args: {
    generationId: string;
    status: string;
    screens: StatusScreen[];
  }) => {
    setActiveGenerationContext(args.generationId);

    applyFrames((current) => {
      const next = new Map(current);

      for (const screen of args.screens) {
        if (isTerminalPersistedScreen(screen, args.status)) {
          const existing = next.get(screen.id);
          const complete = isProbablyCompleteScreen(screen.content);
          next.set(
            screen.id,
            existing
              ? {
                  ...existing,
                  x: screen.x,
                  y: screen.y,
                  w: screen.w,
                  h: screen.h,
                  state: complete ? "done" : "error",
                  content: complete ? screen.content : existing.content,
                  error: complete
                    ? null
                    : (screen.error ?? "Generation did not finish."),
                  generationId: args.generationId,
                }
              : createFrame({
                  id: screen.id,
                  screenName: screen.screenName,
                  platform,
                  generationId: args.generationId,
                  x: screen.x,
                  y: screen.y,
                  w: screen.w,
                  h: screen.h,
                  state: complete ? "done" : "error",
                  content: complete ? screen.content : "",
                  error: complete
                    ? null
                    : (screen.error ?? "Generation did not finish."),
                }),
          );
          continue;
        }

        const existing = next.get(screen.id);
        if (existing?.state === "done") continue;

        next.set(
          screen.id,
          existing
            ? {
                ...existing,
                x: screen.x,
                y: screen.y,
                w: screen.w,
                h: screen.h,
                state: "streaming",
                error: null,
                generationId: args.generationId,
              }
            : createFrame({
                id: screen.id,
                screenName: screen.screenName,
                platform,
                generationId: args.generationId,
                x: screen.x,
                y: screen.y,
                w: screen.w,
                h: screen.h,
                state: "streaming",
              }),
        );
      }

      return next;
    }, true);

    scheduleSnapshotPersist(args.generationId);
  };
  hydrateFromStatusRef.current = hydrateFromStatus;

  const handleFrame = async (id: string, bypassBusyCheck = false) => {
    if (!project) {
      logger.error("Project not found");
      return;
    }

    if (!bypassBusyCheck && isGenerating) {
      logger.warn("Frame regenerate blocked while full generation is active", {
        frameId: id,
      });
      toast.error(
        "Please wait for the current generation to finish before regenerating individual frames.",
      );
      return;
    }

    const sourceFrame = getFramesSnapshot().get(id);
    if (!sourceFrame) {
      logger.warn("Clicked frame not found", { frameId: id });
      return;
    }

    const token = studioStore.getState().bumpSessionToken();
    const abortController = startAbort();
    const promptOverride = prompt.trim();
    const screenName = sourceFrame.screenName;
    let terminalEventReceived = false;
    let streamFailed = false;

    setIsGenerating(true);
    setActiveStreamingScreen(screenName);

    const applyFallbackError = (message: string) => {
      const buffered = runtime().screenBuffers[id] ?? "";
      const candidate = isProbablyCompleteScreen(buffered)
        ? buffered
        : sourceFrame.content;
      const keepContent = isProbablyCompleteScreen(candidate)
        ? candidate
        : sourceFrame.content;

      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;
        const next = new Map(current);
        next.set(id, {
          ...frame,
          generationId: runtime().activeGenerationId ?? frame.generationId,
          state: "error",
          content: keepContent,
          editedContent:
            keepContent === sourceFrame.content
              ? sourceFrame.editedContent
              : null,
          error: message || "Generation did not finish.",
        });
        return next;
      });
    };

    try {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;
        const next = new Map(current);
        next.set(id, { ...frame, state: "skeleton", error: null });
        return next;
      }, true);

      const response = await fetch(`/api/generate/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          projectId: project.id,
          generationId: sourceFrame.generationId,
          ...(promptOverride ? { prompt: promptOverride } : {}),
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await readResponseErrorMessage(response));
      }

      const readResult = await readDomainSse({
        body: response.body,
        signal: abortController.signal,
        isStale: () => token !== runtime().generationToken,
        onEvent: (parsed) => {
          const event = adaptFrameEvent(
            parsed as FrameGenerationEvent,
            screenName,
          );

          if (event.type === "done") {
            terminalEventReceived = true;
            const frame = getFramesSnapshot().get(id);
            if (frame && isStreamOpen(frame.state)) {
              handleEventRef.current(
                { type: "screen_done", screen: screenName, frameId: id },
                token,
              );
            }
            return true;
          }

          if (event.type === "error") {
            terminalEventReceived = true;
            applyFallbackError(event.message);
            return true;
          }

          handleEventRef.current(event, token);
        },
        onMalformed: (raw, parseError) => {
          logger.warn("Skipping malformed frame SSE payload", {
            rawSnippet: raw.slice(0, 200),
            parseError,
          });
        },
      });

      if (readResult === "stale" || readResult === "stopped") {
        return;
      }
    } catch (error) {
      if (
        token !== runtime().generationToken ||
        abortController.signal.aborted
      ) {
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
      if (token !== runtime().generationToken) return;

      if (!streamFailed && !terminalEventReceived) {
        const frame = getFramesSnapshot().get(id);
        if (frame && isStreamOpen(frame.state)) {
          handleEventRef.current(
            { type: "screen_done", screen: screenName, frameId: id },
            token,
          );
        }
      }

      const resolvedGenerationId =
        runtime().activeGenerationId ?? sourceFrame.generationId;
      setActiveGenerationContext(resolvedGenerationId);
      scheduleSnapshotPersist(resolvedGenerationId);
      endBusyIfCurrent(token);
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

    if (generationMode === "regenerate" && activeFrameId) {
      await handleFrame(activeFrameId, true);
      return;
    }

    const token = studioStore
      .getState()
      .beginGenerationRun(crypto.randomUUID());
    const abortController = startAbort();

    setIsGenerating(true);
    setActiveStreamingScreen(null);
    setGenerationErrorMessage(null);
    setGenerationRecoveryPrompt(null);

    let terminalEventReceived = false;
    let streamFailed = false;

    try {
      const sourceFrame = activeFrameId
        ? (getFramesSnapshot().get(activeFrameId) ?? null)
        : null;
      const useFrameContext = Boolean(activeFrameId && sourceFrame);
      const generationId = useFrameContext
        ? (sourceFrame?.generationId ?? "")
        : "";

      if (useFrameContext && !generationId) {
        throw new Error("Unable to find generation ID for active frame.");
      }

      flushPendingSnapshotPersist();

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          projectId: project.id,
          prompt: generationPrompt,
          platform,
          canvasFrames: [...getFramesSnapshot().values()].map((frame) => ({
            id: frame.id,
            x: frame.x,
            y: frame.y,
            w: frame.w,
            h: frame.h,
          })),
          ...(useFrameContext && {
            generationId,
            frameId: sourceFrame!.id,
            createNewFrame: true,
          }),
        }),
        signal: abortController.signal,
      });

      setPrompt("");

      if (!response.ok || !response.body) {
        const errorMessage = await readResponseErrorMessage(response);
        if (response.status === 402) {
          onQuotaExceeded?.(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const readResult = await readDomainSse({
        body: response.body,
        signal: abortController.signal,
        isStale: () => token !== runtime().generationToken,
        onEvent: (parsed) => {
          const event = parsed as GenerationEvent;
          if (event.type === "done" || event.type === "error") {
            terminalEventReceived = true;
          }
          handleEventRef.current(event, token);
        },
        onMalformed: (raw, parseError) => {
          logger.warn("Skipping malformed SSE payload", {
            rawSnippet: raw.slice(0, 200),
            parseError,
          });
        },
      });

      if (readResult === "stale" || readResult === "stopped") {
        return;
      }
    } catch (error) {
      if (
        token !== runtime().generationToken ||
        abortController.signal.aborted
      ) {
        return;
      }

      streamFailed = true;
      const message =
        error instanceof Error
          ? error.message
          : "Generation failed unexpectedly.";
      setGenerationErrorMessage(message);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setGenerationRecoveryPrompt(generationPrompt);
      }

      finalizePendingFrames({ preferError: true, errorMessage: message });
      markProjectActive();
      emitReviewLog("request-failed");
      logger.error("Error generating layout:", error);
    } finally {
      if (
        token !== runtime().generationToken ||
        abortController.signal.aborted
      ) {
        return;
      }

      if (
        !streamFailed &&
        !terminalEventReceived &&
        Object.keys(runtime().frameIdsByScreen).length > 0
      ) {
        logger.warn(
          "Generation stream closed without terminal done/error event; applying completion fallback.",
        );
        finalizePendingFrames();
        markProjectActive();
        emitReviewLog("stream-close-fallback");
        scheduleSnapshotPersist(persistId());
      }

      if (!streamFailed) {
        syncProjectDetailCache();
        void queryClient.invalidateQueries({
          queryKey: ["projects", projectId],
        });
        void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      }

      endBusyIfCurrent(token);
    }
  };

  handleGenerateRef.current = handleGenerate;

  const resumeAfterHydrate = useCallback(
    (hydratedProject: ProjectDetail, restoreComplete: boolean) => {
      if (restoreComplete) {
        const runningGeneration = hydratedProject.generations.find(
          (generation) => generation.status === "RUNNING",
        );

        if (runningGeneration?.generationId) {
          const generationId = runningGeneration.generationId;
          const token = runtime().generationToken;
          const abortController = startAbort();
          setIsGenerating(true);

          void (async () => {
            try {
              const res = await fetch(`/api/generate/status/${generationId}`, {
                credentials: "include",
                signal: abortController.signal,
              });
              if (!res.ok) return;

              const body = (await res.json()) as {
                data?: {
                  status: string;
                  screens: StatusScreen[];
                  pendingScreens: string[];
                };
              };
              const data = body.data;
              if (!data) return;

              hydrateFromStatusRef.current({
                generationId,
                status: data.status,
                screens: data.screens,
              });

              if (data.status === "RUNNING" && data.pendingScreens.length > 0) {
                const watch = await fetch(
                  `/api/generate/watch/${generationId}`,
                  {
                    credentials: "include",
                    signal: abortController.signal,
                  },
                );
                if (!watch.ok || !watch.body) {
                  logger.warn("Watch stream connection failed", {
                    status: watch.status,
                  });
                  return;
                }

                await readDomainSse({
                  body: watch.body,
                  signal: abortController.signal,
                  isStale: () => token !== runtime().generationToken,
                  onEvent: (parsed) => {
                    const event = parsed as GenerationEvent;
                    handleEventRef.current(event, token);
                    return event.type === "done" || event.type === "error";
                  },
                  onMalformed: (raw) => {
                    logger.warn(
                      "Malformed watch SSE payload",
                      raw.slice(0, 200),
                    );
                  },
                });
              }
            } catch (err) {
              if (abortController.signal.aborted) return;
              logger.warn("Reconnect to running generation failed", err);
            } finally {
              endBusyIfCurrent(token);
            }
          })();
        } else {
          const recovered = recoverStalledFrames(getFramesSnapshot());
          if (recovered.changed) {
            updateEphemeral(() => recovered.frames);
            scheduleSnapshotPersist();
          }
        }
      }

      if (
        !runtime().hasInitiatedGeneration &&
        shouldAutoStartProjectGeneration(hydratedProject)
      ) {
        studioStore.getState().setRuntimeInitiatedGeneration(true);
        void handleGenerateRef.current();
      }
    },
    [getFramesSnapshot, scheduleSnapshotPersist, studioStore, updateEphemeral],
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
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    isGenerating,
    activeStreamingScreen,
    generationErrorMessage,
    generationRecoveryPrompt,
    setGenerationErrorMessage,
    setGenerationRecoveryPrompt,
    handleGenerate,
    handleFrame,
    resumeAfterHydrate,
  };
}
