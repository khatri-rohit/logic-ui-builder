import { NextRequest } from "next/server";
import { isAuthError, requireAuthContext } from "@/lib/get-auth";
import prisma from "@/lib/prisma";
import { parseGenerationScreens } from "@/lib/utils";
import { z } from "zod";
import logger from "@/lib/logger";

export const runtime = "nodejs";

const paramsSchema = z.object({
  generationId: z.string().cuid(),
});

const POLL_INTERVAL_MS = 1500;
const TERMINAL_GRACE_MS = 1_500;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ generationId: string }> },
) {
  try {
    const authContext = await requireAuthContext({
      request: req,
      eventType: "generation.watch.requested",
    });

    if (!authContext.appUserId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return new Response("Invalid generation ID", { status: 400 });
    }

    const { generationId } = parsedParams.data;

    // Verify ownership
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        project: { userId: authContext.appUserId },
      },
      select: {
        id: true,
        status: true,
        screens: true,
        errorMessage: true,
        spec: true,
      },
    });

    if (!generation) {
      return new Response("Generation not found", { status: 404 });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      try {
        // Track which screens we have already emitted so we don't duplicate
        const emittedScreenIds = new Set<string>();

        // Initial snapshot
        let lastScreens = parseGenerationScreens(generation.screens);
        for (const screen of lastScreens) {
          if (screen.state === "done" || screen.state === "error") {
            emittedScreenIds.add(screen.id);
            await write({
              type: "screen_done",
              screen: screen.screenName,
              frameId: screen.id,
              content: screen.content,
              error: screen.error,
            });
          }
        }

        if (
          generation.status === "COMPLETED" ||
          generation.status === "FAILED"
        ) {
          await write({
            type: generation.status === "COMPLETED" ? "done" : "error",
            message: generation.errorMessage ?? undefined,
          });
          await writer.close();
          return;
        }

        // Polling loop while RUNNING
        let running = true;
        const terminalDeadline =
          Date.now() + 10 * 60 * 1000; // hard cap: 10 min watch

        while (running && Date.now() < terminalDeadline) {
          await sleep(POLL_INTERVAL_MS);

          const fresh = await prisma.generation.findUnique({
            where: { id: generationId },
            select: { status: true, screens: true, errorMessage: true },
          });

          if (!fresh) {
            await write({ type: "error", message: "Generation disappeared" });
            break;
          }

          const freshScreens = parseGenerationScreens(fresh.screens);

          for (const screen of freshScreens) {
            if (emittedScreenIds.has(screen.id)) continue;
            if (screen.state === "done" || screen.state === "error") {
              emittedScreenIds.add(screen.id);
              await write({
                type: "screen_done",
                screen: screen.screenName,
                frameId: screen.id,
                content: screen.content,
                error: screen.error,
              });
            }
          }

          if (fresh.status === "COMPLETED") {
            await write({ type: "done" });
            running = false;
          } else if (fresh.status === "FAILED") {
            await write({
              type: "error",
              message: fresh.errorMessage ?? "Generation failed",
            });
            running = false;
          }

          lastScreens = freshScreens;
        }

        // Watch deadline elapsed while still RUNNING — fail the generation so
        // project status cannot stay stuck at GENERATING forever.
        if (running) {
          const timeoutMessage =
            "Generation watch timed out before the job finished.";
          const generationRecord = await prisma.generation.findUnique({
            where: { id: generationId },
            select: { status: true, projectId: true },
          });

          if (generationRecord?.status === "RUNNING") {
            await prisma.$transaction([
              prisma.generation.update({
                where: { id: generationId },
                data: {
                  status: "FAILED",
                  terminalAt: new Date(),
                  errorMessage: timeoutMessage,
                  errorMeta: {
                    source: "api/generate/watch",
                    stage: "watch-timeout",
                  },
                },
              }),
              prisma.project.update({
                where: { id: generationRecord.projectId },
                data: { status: "ACTIVE" },
              }),
            ]);
          }

          await write({ type: "error", message: timeoutMessage });
        }

        // Grace period so client receives terminal event
        await sleep(TERMINAL_GRACE_MS);
      } catch (err) {
        logger.warn("Watch stream error", err);
        try {
          await write({ type: "error", message: "Watch stream error" });
        } catch {
          /* ignore */
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (isAuthError(error)) {
      return new Response(error.message, { status: error.status });
    }
    const err = error as Error;
    return new Response(err.message, { status: 500 });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
