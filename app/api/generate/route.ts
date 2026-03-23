import { NextRequest, NextResponse } from "next/server";
import { initializeOllama } from "@/lib/ollama";

import { generateText, streamText } from "ai";
import {
  buildScreenPrompt,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
} from "@/lib/prompts";
import { ComponentTreeNode, WebAppSpec } from "@/lib/types";
import logger from "@/lib/logger";

export const runtime = "nodejs";

const STAGE1_MODELS = ["qwen3.5:9b", "llama3.2-vision:11b", "llama3.1:8b"];
const STAGE2_MODELS = ["qwen3.5:9b", "llama3.1:8b", "mistral:7b"];
const STAGE3_MODELS = [
  "minimax-m2.7:cloud",
  "deepseek-v3.1:671b-cloud",
  "qwen3.5:9b",
  "llama3.2-vision:11b",
  "llama3.1:8b",
  "mistral:7b",
];

function parseJsonStrict<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON object found in model output");
    return JSON.parse(match[0]) as T;
  }
}

async function generateWithModelFallback(
  ollama: ReturnType<typeof initializeOllama>,
  models: string[],
  system: string,
  prompt: string,
): Promise<{ text: string; model: string }> {
  let lastError: unknown = null;
  for (const model of models) {
    try {
      const { text } = await generateText({
        model: ollama(model),
        system,
        prompt,
      });
      logger.info(`Raw output from model ${model}: ${text}`);
      return { text, model };
    } catch (err) {
      lastError = err;
      logger.warn(`Model failed: ${model}`, err);
    }
  }

  throw new Error(`All models failed: ${String(lastError)}`);
}

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      // Platform is intentionally fixed to web for current generation pipeline.
      // stylingLib,
      // model = "mistral:7b", // 82s, 41s
      // model = "qwen3.5:9b", // 47s
      // model = "llama3.2-vision:11b", // 33s, 46s
      // model = "llama3.1:8b", // 1.3m, 10.7s, 35.3s
      model = "deepseek-v3.1:671b-cloud", // 20.7s, 13.7
      // model = "minimax-m2.7:cloud", // feels slow generation of code_chunk
    } = await req.json();
    const platform = "web";
    const stage3ModelPriority = [
      model,
      ...STAGE3_MODELS.filter((m) => m !== model),
    ];

    const ollama = initializeOllama();

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      try {
        // Stage 1 — structured spec extraction (non-streaming)
        // generateText = wait for full response, no stream
        logger.info("Starting Stage 1: Spec Extraction");

        const { text: rawSpec, model: stage1Model } =
          await generateWithModelFallback(
            ollama,
            STAGE1_MODELS,
            STAGE1_SYSTEM,
            `User prompt: ${prompt}\nPlatform: ${platform}`,
          );
        const spec = parseJsonStrict<WebAppSpec>(rawSpec);
        logger.info(`Stage 1 complete via model: ${stage1Model}`);
        await write({ type: "spec", spec });

        // Stage 2 — component planner (non-streaming)
        logger.info("Starting Stage 2: Component Planner");
        const { text: rawTree, model: stage2Model } =
          await generateWithModelFallback(
            ollama,
            STAGE2_MODELS,
            STAGE2_SYSTEM,
            `${platform}Spec: ${JSON.stringify(spec)}`,
          );
        const tree = parseJsonStrict<ComponentTreeNode[]>(rawTree);
        logger.info(`Stage 2 complete via model: ${stage2Model}`);
        await write({ type: "tree", tree });

        // Stage 3 — code synthesis per screen (streaming)
        logger.info("Starting Stage 3: Code Synthesis");
        for (const screen of spec.screens) {
          await write({ type: "screen_start", screen });

          let screenGenerated = false;
          let streamErr: unknown = null;

          for (let i = 0; i < stage3ModelPriority.length; i++) {
            const candidateModel = stage3ModelPriority[i];
            try {
              if (i > 0) {
                await write({
                  type: "screen_reset",
                  screen,
                  reason: `retry:${candidateModel}`,
                });
              }

              logger.info(
                `Stage 3 screen '${screen}' via model: ${candidateModel}`,
              );
              const result = streamText({
                model: ollama(candidateModel),
                system: STAGE3_SYSTEM,
                prompt: buildScreenPrompt(spec, tree, screen),
                temperature: 0.2,
              });

              for await (const token of result.textStream) {
                await write({ type: "code_chunk", screen, token });
              }

              screenGenerated = true;
              break;
            } catch (err) {
              streamErr = err;
              logger.warn(
                `Stage 3 model failed for '${screen}': ${candidateModel}`,
                err,
              );
            }
          }

          if (!screenGenerated) {
            throw new Error(
              `All stage 3 models failed for ${screen}: ${String(streamErr)}`,
            );
          }

          await write({ type: "screen_done", screen });
        }

        logger.info("Generation complete");
        await write({ type: "done" });
      } catch (err) {
        await write({ type: "error", message: String(err) });
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
    const err = error as Error;
    logger.error(err);
    return NextResponse.json(
      {
        error: true,
        message: err.message,
      },
      { status: 500 },
    );
  }
}
