import type { ProjectDetail, ProjectGeneration } from "@/lib/api/types";

function generationHasScreens(generation: ProjectGeneration): boolean {
  return generation.screens.length > 0;
}

/**
 * True only for a brand-new project that has never produced screens.
 * Finished / ACTIVE projects must never auto-replay initialPrompt on reopen,
 * even when a stale React Query cache still shows frames: [].
 */
export function shouldAutoStartProjectGeneration(
  project: Pick<ProjectDetail, "status" | "frames" | "generations">,
): boolean {
  if (project.status === "ARCHIVED") return false;
  if (project.status !== "PENDING") return false;

  if (project.frames.length > 0) return false;

  const hasCompletedOrScreens = project.generations.some(
    (generation) =>
      generation.status === "COMPLETED" || generationHasScreens(generation),
  );
  if (hasCompletedOrScreens) return false;

  const hasRunning = project.generations.some(
    (generation) => generation.status === "RUNNING",
  );
  if (hasRunning) return false;

  return true;
}
