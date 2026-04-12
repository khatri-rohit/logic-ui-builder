import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiError, requestApi } from "@/lib/api/http";
import { ProjectDetail, ProjectSummary } from "../api/types";

type CreateProjectInput = {
  prompt: string;
};

type CreateProjectResult = {
  projectId: string;
  title: string;
  description: string | null;
  spec: "web" | "mobile";
  model: string;
  updatedAt: string;
};

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: () => [...projectKeys.lists(), "all"] as const,
};

async function listProjects() {
  return requestApi<ProjectSummary[]>("/api/projects/all");
}

async function createProject({ prompt }: CreateProjectInput) {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new ApiError("Prompt are required.", 400, "INVALID_PROMPT");
  }

  return requestApi<CreateProjectResult>("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: normalizedPrompt }),
  });
}

export function projectsListQueryOptions() {
  return queryOptions({
    queryKey: projectKeys.list(),
    queryFn: listProjects,
    refetchOnWindowFocus: false,
  });
}

export function useProjectsQuery() {
  return useQuery(projectsListQueryOptions());
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

export function projectDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["projects", id] as const,
    queryFn: () => getProject(id),
    enabled: !!id,
    staleTime: 30 * 1000,
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
export async function updateProjectStatus(
  id: string,
  status: "PENDING" | "GENERATING" | "ACTIVE" | "ARCHIVED",
) {
  return requestApi<{ status: ProjectDetail["status"] }>(
    `/api/projects/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );
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
    onSuccess: (data: { status: ProjectDetail["status"] }, { id }) => {
      queryClient.setQueryData<ProjectDetail>(["projects", id], (prev) =>
        prev ? { ...prev, status: data.status } : prev,
      );
    },
  });
}

// -- Update prject thumbnail after generation
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
