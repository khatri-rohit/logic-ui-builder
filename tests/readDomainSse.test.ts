import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDomainSse } from "../lib/sse/readDomainSse";

function streamFrom(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("readDomainSse", () => {
  it("parses JSON events and stops on [DONE]", async () => {
    const events: unknown[] = [];
    const result = await readDomainSse({
      body: streamFrom([
        `data: ${JSON.stringify({ type: "done" })}\n\n`,
        "data: [DONE]\n\n",
      ]),
      onEvent: (event) => {
        events.push(event);
      },
    });

    assert.equal(result, "stopped");
    assert.deepEqual(events, [{ type: "done" }]);
  });

  it("returns stale when isStale flips", async () => {
    const result = await readDomainSse({
      body: streamFrom([`data: ${JSON.stringify({ type: "layout" })}\n\n`]),
      isStale: () => true,
      onEvent: () => undefined,
    });
    assert.equal(result, "stale");
  });

  it("skips malformed lines", async () => {
    const events: unknown[] = [];
    const malformed: string[] = [];
    const result = await readDomainSse({
      body: streamFrom([
        "data: {not-json\n\n",
        `data: ${JSON.stringify({ type: "done" })}\n\n`,
      ]),
      onEvent: (event) => {
        events.push(event);
      },
      onMalformed: (raw) => {
        malformed.push(raw);
      },
    });

    assert.equal(result, "closed");
    assert.equal(malformed.length, 1);
    assert.deepEqual(events, [{ type: "done" }]);
  });
});
