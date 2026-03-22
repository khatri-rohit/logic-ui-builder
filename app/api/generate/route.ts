import { NextRequest, NextResponse } from "next/server";
import { initializeOllama } from "@/lib/ollama";

import { generateText, streamText } from "ai";
import {
  buildScreenPrompt,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
} from "@/lib/prompts";
import logger from "@/lib/logger";

export const runtime = "nodejs";

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
      // model = "deepseek-v3.1:671b-cloud", // 20.7s, 13.7
      model = "minimax-m2.7:cloud", //
    } = await req.json();
    const platform = "web";

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

        const { text: rawSpec } = await generateText({
          model: ollama("llama3.2-vision:11b"),
          system: STAGE1_SYSTEM,
          prompt: `User prompt: ${prompt}\nPlatform: ${platform}`,
        });
        const spec = JSON.parse(rawSpec);
        await write({ type: "spec", spec });

        // Stage 2 — component planner (non-streaming)
        logger.info("Starting Stage 2: Component Planner");
        const { text: rawTree } = await generateText({
          model: ollama("qwen3.5:9b"),
          system: STAGE2_SYSTEM,
          prompt: `${platform}Spec: ${JSON.stringify(spec)}`,
        });
        const tree = JSON.parse(rawTree);
        await write({ type: "tree", tree });

        // Stage 3 — code synthesis per screen (streaming)
        logger.info("Starting Stage 3: Code Synthesis");
        for (const screen of spec.screens) {
          await write({ type: "screen_start", screen });

          // streamText handles all NDJSON parsing internally
          const result = streamText({
            model: ollama(model),
            system: STAGE3_SYSTEM,
            prompt: buildScreenPrompt(spec, tree, screen),
            temperature: 0.2,
          });

          // textStream is an AsyncIterable — just loop over tokens
          for await (const token of result.textStream) {
            await write({ type: "code_chunk", screen, token });
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
