import type { Prisma } from "@/app/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client";

/** Matches the watch stream hard cap — beyond this, RUNNING is treated as stale. */
export const GENERATION_LOCK_TTL_MS = 10 * 60 * 1000;

export type GenerationLockDecision =
  | { action: "allow" }
  | { action: "block"; reason: "live_running" }
  | {
      action: "recover";
      recoveredGenerationIds: string[];
    };

export function decideGenerationLock(args: {
  projectStatus: string | null | undefined;
  runningGenerations: Array<{ id: string; updatedAt: Date }>;
  now?: Date;
  ttlMs?: number;
}): GenerationLockDecision {
  const now = args.now ?? new Date();
  const ttlMs = args.ttlMs ?? GENERATION_LOCK_TTL_MS;

  const live = args.runningGenerations.filter(
    (generation) => now.getTime() - generation.updatedAt.getTime() <= ttlMs,
  );

  if (live.length > 0) {
    return { action: "block", reason: "live_running" };
  }

  if (
    args.projectStatus === "GENERATING" ||
    args.runningGenerations.length > 0
  ) {
    return {
      action: "recover",
      recoveredGenerationIds: args.runningGenerations.map((g) => g.id),
    };
  }

  return { action: "allow" };
}

/**
 * Blocks only while a generation is actually live. Stale GENERATING / RUNNING
 * leftovers (interrupted runs, crashed workers) are recovered so frame regen
 * can proceed.
 */
export async function assertProjectAvailableForFrameRegen(
  tx: Prisma.TransactionClient,
  projectId: string,
  options?: { now?: Date; ttlMs?: number },
): Promise<{ blocked: true } | { blocked: false; recovered: boolean }> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  const runningGenerations = await tx.generation.findMany({
    where: { projectId, status: "RUNNING" },
    select: { id: true, updatedAt: true },
  });

  const decision = decideGenerationLock({
    projectStatus: project?.status,
    runningGenerations,
    now: options?.now,
    ttlMs: options?.ttlMs,
  });

  if (decision.action === "block") {
    return { blocked: true };
  }

  if (decision.action === "recover") {
    const now = options?.now ?? new Date();
    if (decision.recoveredGenerationIds.length > 0) {
      await tx.generation.updateMany({
        where: { id: { in: decision.recoveredGenerationIds } },
        data: {
          status: "FAILED",
          terminalAt: now,
          errorMessage: "Generation timed out or was interrupted.",
          errorMeta: {
            source: "generationLock",
            stage: "stale-recovery",
          } as unknown as PrismaNamespace.InputJsonValue,
        },
      });
    }

    await tx.project.update({
      where: { id: projectId },
      data: { status: "ACTIVE" },
    });

    return { blocked: false, recovered: true };
  }

  return { blocked: false, recovered: false };
}
