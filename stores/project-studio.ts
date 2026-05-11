import { createStore } from "zustand";

import {
  CanvasFrameSnapshot,
  CanvasStateMetadataV1,
  FrameState,
} from "@/lib/canvas-state";
import { ProjectDetail, ProjectGeneration } from "@/lib/api/types";

export interface ProjectStudioViewState extends CanvasStateMetadataV1 {
  frames: CanvasFrameSnapshot[];
}

export interface ProjectStudioGenerationReviewEntry {
  screenName: string;
  generationId: string;
  state: FrameState;
  error: string | null;
  code: string;
}

export interface ProjectStudioRuntimeState {
  generationToken: number;
  generationRunId: string | null;
  activeGenerationId: string | null;
  frameIdsByScreen: Record<string, string[]>;
  activeFrameIdsByScreen: Record<string, string>;
  screenBuffers: Record<string, string>;
  dirtyScreens: string[];
  generationReviewEntries: Record<string, ProjectStudioGenerationReviewEntry>;
  generationLogEmitted: boolean;
  hasHydratedCanvas: boolean;
  hasInitiatedGeneration: boolean;
}

export interface ProjectStudioState {
  projectId: string | null;
  studio: ProjectStudioViewState | null;
  generations: ProjectGeneration[];
  runtime: ProjectStudioRuntimeState;
}

export interface ProjectStudioActions {
  hydrateFromProject: (project: ProjectDetail) => void;
  setCanvasMetadata: (metadata: CanvasStateMetadataV1 | null) => void;
  setStudioFrames: (frames: CanvasFrameSnapshot[]) => void;
  setSelectedGenerationId: (generationId: string | null) => void;
  upsertGeneration: (generation: ProjectGeneration) => void;
  beginGenerationRun: (runId: string) => number;
  updateRuntime: (
    updater: (runtime: ProjectStudioRuntimeState) => ProjectStudioRuntimeState,
  ) => void;
  setRuntimeHydrated: (value: boolean) => void;
  setRuntimeInitiatedGeneration: (value: boolean) => void;
  resetStudioState: () => void;
}

export type ProjectStudioStore = ProjectStudioState & ProjectStudioActions;

function createDefaultRuntimeState(): ProjectStudioRuntimeState {
  return {
    generationToken: 0,
    generationRunId: null,
    activeGenerationId: null,
    frameIdsByScreen: {},
    activeFrameIdsByScreen: {},
    screenBuffers: {},
    dirtyScreens: [],
    generationReviewEntries: {},
    generationLogEmitted: false,
    hasHydratedCanvas: false,
    hasInitiatedGeneration: false,
  };
}

function createDefaultState(): ProjectStudioState {
  return {
    projectId: null,
    studio: null,
    generations: [],
    runtime: createDefaultRuntimeState(),
  };
}

function createDefaultStudioState(
  project: ProjectDetail,
  selectedGenerationId: string | null,
): ProjectStudioViewState {
  return {
    version: 1,
    camera: { x: 0, y: 0, k: 1 },
    activeFrameId: null,
    selectedFrameId: null,
    selectedGenerationId,
    savedAt: new Date().toISOString(),
    frames: project.frames,
  };
}

export const createProjectStudioStore = () =>
  createStore<ProjectStudioStore>()((set, get) => ({
    ...createDefaultState(),
    hydrateFromProject: (project) => {
      const fallbackSelectedGenerationId =
        project.generations[project.generations.length - 1]?.generationId ??
        null;

      const studio = project.canvasState
        ? {
            ...project.canvasState,
            selectedGenerationId:
              project.canvasState.selectedGenerationId ??
              fallbackSelectedGenerationId,
            frames: project.frames,
          }
        : createDefaultStudioState(project, fallbackSelectedGenerationId);

      set({
        projectId: project.id,
        studio,
        generations: project.generations,
        runtime: {
          ...get().runtime,
          activeGenerationId: studio.selectedGenerationId ?? null,
        },
      });
    },
    setCanvasMetadata: (metadata) => {
      const current = get().studio;
      if (!current && !metadata) {
        return;
      }

      if (!metadata) {
        set({ studio: null });
        return;
      }

      set({
        studio: {
          ...metadata,
          selectedGenerationId: metadata.selectedGenerationId ?? null,
          frames: current?.frames ?? [],
        },
      });
    },
    setStudioFrames: (frames) => {
      const current = get().studio;
      if (!current) {
        return;
      }

      set({
        studio: {
          ...current,
          frames,
          savedAt: new Date().toISOString(),
        },
      });
    },
    setSelectedGenerationId: (generationId) => {
      const current = get().studio;
      if (!current) {
        return;
      }

      set({
        studio: {
          ...current,
          selectedGenerationId: generationId,
          savedAt: new Date().toISOString(),
        },
      });
    },
    upsertGeneration: (generation) => {
      const currentGenerations = get().generations;
      const existingIndex = currentGenerations.findIndex(
        (item) => item.generationId === generation.generationId,
      );

      if (existingIndex === -1) {
        set({ generations: [...currentGenerations, generation] });
        return;
      }

      const next = [...currentGenerations];
      next[existingIndex] = generation;
      set({ generations: next });
    },
    beginGenerationRun: (runId) => {
      const current = get().runtime;
      const nextToken = current.generationToken + 1;

      set({
        runtime: {
          ...current,
          generationToken: nextToken,
          generationRunId: runId,
          activeGenerationId: null,
          frameIdsByScreen: {},
          activeFrameIdsByScreen: {},
          screenBuffers: {},
          dirtyScreens: [],
          generationReviewEntries: {},
          generationLogEmitted: false,
        },
      });

      return nextToken;
    },
    updateRuntime: (updater) => {
      set({ runtime: updater(get().runtime) });
    },
    setRuntimeHydrated: (value) => {
      set({
        runtime: {
          ...get().runtime,
          hasHydratedCanvas: value,
        },
      });
    },
    setRuntimeInitiatedGeneration: (value) => {
      set({
        runtime: {
          ...get().runtime,
          hasInitiatedGeneration: value,
        },
      });
    },
    resetStudioState: () => set(createDefaultState()),
  }));
