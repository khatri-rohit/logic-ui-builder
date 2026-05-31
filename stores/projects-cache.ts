import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ProjectSummary } from "@/lib/api/types";

interface ProjectsCacheState {
  projects: ProjectSummary[] | null;
  lastFetchedAt: number | null;
  setProjects: (projects: ProjectSummary[]) => void;
}

export const useProjectsCacheStore = create<ProjectsCacheState>()(
  persist(
    (set) => ({
      projects: null,
      lastFetchedAt: null,
      setProjects: (projects) => set({ projects, lastFetchedAt: Date.now() }),
    }),
    {
      name: "logic-projects-cache",
    },
  ),
);
