import { NextRequest, NextResponse } from "next/server";
import { initializeOllama } from "@/lib/ollama";

import {
  generateText,
  streamText,
  StreamObjectOnFinishCallback,
  readUIMessageStream,
} from "ai";
import {
  buildScreenPrompt,
  MOBILE_SPEC_SCHEMA,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
} from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      platform,
      stylingLib,
      // model = "mistral:7b", // 82s, 41s
      // model = "qwen3.5:9b", // 47s
      // model = "llama3.2-vision:11b", // 33s, 46s
      // model = "llama3.1:8b", // 1.3m, 10.7s, 35.3s
      model = "deepseek-v3.1:671b-cloud", // 20.7s, 13.7
    } = await req.json();

    const ollama = initializeOllama();

    const { textStream } = streamText({
      model: ollama(model),
      prompt,
      providerOptions: {
        ollama: { think: true }, // model reasons before outputting JSON
      },
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = (payload: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    // Fire async — do NOT await this before returning Response
    (async () => {
      try {
        for await (const text of textStream) {
          await write({ type: "chat", text });
        }
      } catch (err) {
        await write({ type: "error", message: String(err) });
      } finally {
        await writer.close(); // ← also missing — stream never terminated
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });

    // return NextResponse.json({
    //   error: false,
    //   message: "Success",
    //   model,
    //   result,
    // });
  } catch (error) {
    const err = error as Error;
    console.log(err);
    return NextResponse.json(
      {
        error: true,
        message: err.message,
      },
      { status: 500 },
    );
  }
}
