import {
  CanvasFrameSnapshot,
  CanvasStateMetadataV1,
  PersistedGenerationScreen,
} from "@/lib/canvas-state";
import { GenerationPlatform, WebAppSpec } from "@/lib/types";

export interface ApiResponse<T> {
  error: boolean;
  message: string;
  data: T | null;
  code?: string;
}

export type ProjectStatus = "PENDING" | "GENERATING" | "ACTIVE" | "ARCHIVED";

export type GenerationStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ProjectGeneration {
  generationId: string;
  model: string;
  platform: GenerationPlatform;
  spec: WebAppSpec | null;
  screens: PersistedGenerationScreen[];
  status: GenerationStatus;
  terminalAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStudioHydration {
  canvasState: CanvasStateMetadataV1 | null;
  frames: CanvasFrameSnapshot[];
  generations: ProjectGeneration[];
}

export type ProjectDetail = {
  id: string;
  title: string;
  description: string | null;
  initialPrompt: string;
  status: ProjectStatus;
  canvasState: CanvasStateMetadataV1 | null;
  frames: CanvasFrameSnapshot[];
  generations: ProjectGeneration[];
};

export type ProjectPatchResult = {
  project: {
    id: string;
    title: string;
    description: string | null;
    initialPrompt: string;
    status: ProjectStatus;
    canvasState: CanvasStateMetadataV1 | null;
  };
  generation: ProjectGeneration | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: ProjectStatus;
  updatedAt: string;
};
