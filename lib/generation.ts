import {
  GenerationPlatform as PrismaGenerationPlatform,
  Prisma,
} from "@/app/generated/prisma/client";
import { GenerationPlatform } from "@/lib/types";

export function toApiPlatform(
  platform: PrismaGenerationPlatform,
): GenerationPlatform {
  return platform === "MOBILE" ? "mobile" : "web";
}

export function toPrismaPlatform(
  platform: GenerationPlatform,
): PrismaGenerationPlatform {
  return platform === "mobile" ? "MOBILE" : "WEB";
}

export function buildModelPriority(
  preferredModel: string | null,
  defaults: readonly string[],
): string[] {
  if (!preferredModel) {
    return [...defaults];
  }

  if (defaults.includes(preferredModel)) {
    return [
      preferredModel,
      ...defaults.filter((model) => model !== preferredModel),
    ];
  }

  return [preferredModel, ...defaults];
}

export function createModelAbortSignal(
  controller: AbortController,
  timeoutMs = 120_000,
): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
  }
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
    timeoutController.abort();
  });
  return timeoutController.signal;
}

export async function reserveGenerationWithIdempotency(
  tx: Prisma.TransactionClient,
  data: {
    projectId: string;
    prompt: string;
    model: string;
    platform: PrismaGenerationPlatform;
    spec: Prisma.InputJsonValue;
    tree?: Prisma.InputJsonValue;
    idempotencyKey: string | null;
  },
): Promise<{ generationId: string; isNew: boolean; status?: string }> {
  if (!data.idempotencyKey) {
    const generation = await tx.generation.create({
      data: {
        projectId: data.projectId,
        prompt: data.prompt,
        model: data.model,
        platform: data.platform,
        spec: data.spec,
        tree: data.tree,
        status: "RUNNING",
      },
      select: { id: true, status: true },
    });
    return { generationId: generation.id, isNew: true };
  }

  try {
    const generation = await tx.generation.create({
      data: {
        projectId: data.projectId,
        prompt: data.prompt,
        model: data.model,
        platform: data.platform,
        spec: data.spec,
        tree: data.tree,
        status: "RUNNING",
        idempotencyKey: data.idempotencyKey,
      },
      select: { id: true, status: true },
    });
    return { generationId: generation.id, isNew: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await tx.generation.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new Error(
          "Race condition: duplicate generation not found after P2002",
        );
      }
      return {
        generationId: existing.id,
        isNew: false,
        status: existing.status,
      };
    }
    throw error;
  }
}
