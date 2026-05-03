import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiError, requestApi } from "@/lib/api/http";
import {
  ProjectDetail,
  ProjectGeneration,
  ProjectPatchResult,
  ProjectStatus,
  ProjectSummary,
} from "../api/types";
import { CanvasFrameSnapshot, CanvasSnapshotV1 } from "@/lib/canvas-state";

type CreateProjectInput = {
  prompt: string;
  platform: "web" | "mobile";
};

type CreateProjectResult = {
  projectId: string;
  title: string;
  description: string | null;
  platform: "web" | "mobile";
  model: string;
  updatedAt: string;
};

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: () => [...projectKeys.lists(), "all"] as const,
};

async function listProjects() {
  return requestApi<ProjectSummary[]>("/api/projects/all", {
    next: { tags: ["projects:list"] },
  });
}

async function createProject({ prompt, platform }: CreateProjectInput) {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new ApiError("Prompt are required.", 400, "INVALID_PROMPT");
  }

  return requestApi<CreateProjectResult>("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: normalizedPrompt, platform }),
    next: { tags: ["list"] },
  });
}

export function projectsListQueryOptions() {
  return queryOptions({
    queryKey: projectKeys.list(),
    queryFn: listProjects,
    refetchOnWindowFocus: false,
    staleTime: Infinity, // ← Data never becomes stale
  });
}

export function useProjectsQuery() {
  return useQuery({
    ...projectsListQueryOptions(),
    refetchInterval: (query) => {
      const projects = query.state.data;
      return projects?.some(
        (project) =>
          project.status === "PENDING" || project.status === "GENERATING",
      )
        ? 5000
        : false;
    },
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      // queryClient.setQueryData<ProjectSummary[]>(
      //   projectKeys.list(),
      //   (currentProjects) => {
      //     if (!currentProjects) {
      //       return currentProjects;
      //     }

      //     if (
      //       currentProjects.some(
      //         (project) => project.id === createdProject.projectId,
      //       )
      //     ) {
      //       return currentProjects;
      //     }

      //     return [
      //       {
      //         id: createdProject.projectId,
      //         title: createdProject.title,
      //         description: createdProject.description,
      //         thumbnailUrl: null,
      //         updatedAt: createdProject.updatedAt,
      //       },
      //       ...currentProjects,
      //     ];
      //   },
      // );

      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

//  -- Queries for project details
async function getProject(id: string): Promise<ProjectDetail> {
  return requestApi<ProjectDetail>(`/api/projects/${id}`);
}

function flattenGenerationFrames(
  generations: ProjectGeneration[],
): CanvasFrameSnapshot[] {
  return generations.flatMap((generation) =>
    generation.screens.map((screen) => ({
      ...screen,
      generationId: generation.generationId,
      platform: generation.platform,
    })),
  );
}

function mergePatchedProjectDetail(
  previous: ProjectDetail | undefined,
  patchResult: ProjectPatchResult,
): ProjectDetail | undefined {
  if (!previous) {
    const generations = patchResult.generation ? [patchResult.generation] : [];

    return {
      id: patchResult.project.id,
      title: patchResult.project.title,
      description: patchResult.project.description,
      initialPrompt: patchResult.project.initialPrompt,
      status: patchResult.project.status,
      platform: patchResult.project.platform,
      canvasState: patchResult.project.canvasState,
      generations,
      frames: flattenGenerationFrames(generations),
    };
  }

  let generations = previous.generations;

  if (patchResult.generation) {
    const existingIndex = generations.findIndex(
      (generation) =>
        generation.generationId === patchResult.generation?.generationId,
    );

    if (existingIndex === -1) {
      generations = [...generations, patchResult.generation];
    } else {
      generations = [...generations];
      generations[existingIndex] = patchResult.generation;
    }
  }

  return {
    ...previous,
    id: patchResult.project.id,
    title: patchResult.project.title,
    description: patchResult.project.description,
    initialPrompt: patchResult.project.initialPrompt,
    status: patchResult.project.status,
    platform: patchResult.project.platform,
    canvasState: patchResult.project.canvasState,
    generations,
    frames: flattenGenerationFrames(generations),
  };
}

export function projectDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["projects", id] as const,
    queryFn: () => getProject(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: Infinity, // ← Data never becomes stale
  });
}

export function useProjectQuery(id: string) {
  return useQuery(projectDetailQueryOptions(id));
}

// -- Mutations for project delete
export async function deleteProject(id: string) {
  return requestApi<{ error: boolean }>(`/api/projects/${id}`, {
    method: "DELETE",
  });
}

export function useProjectDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteProject(id),
    onSuccess: (_data, variables) => {
      const { id } = variables;

      // Remove from list cache
      queryClient.setQueryData<ProjectSummary[]>(projectKeys.list(), (prev) =>
        prev?.filter((p) => p.id !== id),
      );
      // Invalidate detail
      queryClient.removeQueries({ queryKey: ["projects", id], exact: true });
    },
  });
}

// -- Mutations for project status update
export async function updateProjectStatus(id: string, status: ProjectStatus) {
  return requestApi<ProjectPatchResult>(`/api/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

export function useProjectStatusUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: ProjectDetail["status"];
    }) => updateProjectStatus(id, status),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData<ProjectDetail>(["projects", id], (prev) =>
        mergePatchedProjectDetail(prev, data),
      );
    },
  });
}

export async function updateProjectMetadata(
  id: string,
  input: { title: string; description: string },
) {
  return requestApi<ProjectPatchResult>(`/api/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function useProjectMetadataUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      title,
      description,
    }: {
      id: string;
      title: string;
      description: string;
    }) => updateProjectMetadata(id, { title, description }),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData<ProjectDetail>(["projects", id], (prev) =>
        mergePatchedProjectDetail(prev, data),
      );
      queryClient.setQueryData<ProjectSummary[]>(projectKeys.list(), (prev) =>
        prev?.map((project) =>
          project.id === id
            ? {
                ...project,
                title: data.project.title,
                description: data.project.description,
              }
            : project,
        ),
      );
    },
  });
}

export async function updateProjectCanvasState(
  id: string,
  canvasState: CanvasSnapshotV1 | null,
  generationId?: string,
) {
  return requestApi<ProjectPatchResult>(`/api/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ canvasState, generationId }),
    keepalive: true, // Allow the request to outlive the page if the user navigates away
  });
}

type CanvasStateMutationOptions = {
  onConflict?: () => void;
  onPersisted?: () => void;
  onError?: (error: unknown) => void;
};

export function useProjectCanvasStateUpdateMutation(
  options?: CanvasStateMutationOptions,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      canvasState,
      generationId,
    }: {
      id: string;
      canvasState: CanvasSnapshotV1 | null;
      generationId?: string;
    }) => updateProjectCanvasState(id, canvasState, generationId),
    retry: (failureCount, error) => {
      return (
        error instanceof ApiError && error.status === 409 && failureCount < 2
      );
    },
    retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 2000),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData<ProjectDetail>(["projects", id], (prev) =>
        mergePatchedProjectDetail(prev, data),
      );

      options?.onPersisted?.();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        options?.onConflict?.();
        return;
      }

      options?.onError?.(error);
    },
  });
}

// -- Update project thumbnail after generation
export async function updateProjectThumbnail(id: string, thumbnail: Blob) {
  const body = new FormData();
  body.append("thumbnail", thumbnail, "thumbnail.png");

  return requestApi<{ thumbnailUrl: string }>(`/api/projects/${id}/thumbnail`, {
    method: "PATCH",
    body,
  });
}

export function useProjectThumbnailUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, thumbnail }: { id: string; thumbnail: Blob }) =>
      updateProjectThumbnail(id, thumbnail),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData<ProjectDetail>(["projects", id], (prev) =>
        prev ? { ...prev, thumbnailUrl: data.thumbnailUrl } : prev,
      );

      queryClient.setQueryData<ProjectSummary[]>(projectKeys.list(), (prev) =>
        prev?.map((project) =>
          project.id === id
            ? { ...project, thumbnailUrl: data.thumbnailUrl }
            : project,
        ),
      );
    },
  });
}

// -- Delete perticular screen from generation
export async function deleteGenerationScreen(
  projectId: string,
  generationId: string,
  screenId: string,
) {
  return requestApi(
    `/api/projects/${projectId}/generations/${generationId}/screens/${screenId}`,
    {
      method: "DELETE",
    },
  );
}

export function useDeleteGenerationScreenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      generationId,
      screenId,
    }: {
      projectId: string;
      generationId: string;
      screenId: string;
    }) => deleteGenerationScreen(projectId, generationId, screenId),
    onSuccess: (_data, { projectId, generationId, screenId }) => {
      queryClient.setQueryData<ProjectDetail>(
        ["projects", projectId],
        (prev) => {
          if (!prev) return prev;

          const generations = prev.generations.map((generation) => {
            if (generation.generationId !== generationId) {
              return generation;
            }
            return {
              ...generation,
              screens: generation.screens.filter(
                (screen) => screen.id !== screenId,
              ),
            };
          });

          const frames = flattenGenerationFrames(generations);

          return {
            ...prev,
            generations,
            frames,
          };
        },
      );
    },
  });
}
