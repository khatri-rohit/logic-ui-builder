/**
 * Shared reader for the studio's custom domain SSE protocol
 * (`data: ${JSON.stringify(event)}\n\n` + optional `data: [DONE]`).
 *
 * Does not change event shapes — only deduplicates the getReader /
 * TextDecoder / line-buffer loop used by full generate, frame regen, and watch.
 */

export type ReadDomainSseResult = "stopped" | "stale" | "closed";

export type ReadDomainSseOptions = {
  body: ReadableStream<Uint8Array>;
  signal?: AbortSignal;
  isStale?: () => boolean;
  /**
   * Called for each parsed JSON event.
   * Return `true` to stop reading the stream.
   */
  onEvent: (event: unknown) => boolean | void;
  onMalformed?: (raw: string, error: unknown) => void;
};

export async function readDomainSse({
  body,
  signal,
  isStale,
  onEvent,
  onMalformed,
}: ReadDomainSseOptions): Promise<ReadDomainSseResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";

  const processLines = (lines: string[]): ReadDomainSseResult | null => {
    for (const line of lines) {
      if (isStale?.()) {
        return "stale";
      }

      if (!line.startsWith("data:")) continue;

      const raw = line.slice(5).trim();
      if (!raw) continue;

      if (raw === "[DONE]") {
        return "stopped";
      }

      try {
        const event: unknown = JSON.parse(raw);
        if (onEvent(event) === true) {
          return "stopped";
        }
      } catch (error) {
        onMalformed?.(raw, error);
      }
    }

    return null;
  };

  try {
    while (true) {
      if (signal?.aborted) {
        return "stopped";
      }
      if (isStale?.()) {
        return "stale";
      }

      const { done, value } = await reader.read();

      if (isStale?.()) {
        return "stale";
      }

      if (value) {
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() ?? "";

        const result = processLines(lines);
        if (result) {
          return result;
        }
      }

      if (done) {
        sseBuffer += decoder.decode();
        if (sseBuffer) {
          const result = processLines(sseBuffer.split(/\r?\n/));
          if (result) {
            return result;
          }
        }
        return "closed";
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released after abort / cancel.
    }
  }
}

/**
 * Interval flusher shared by full-generate and frame-regen chunk batching.
 */
export function createChunkIntervalFlusher(
  flush: () => void,
  intervalMs: number,
) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (intervalId) return;
      intervalId = setInterval(flush, intervalMs);
    },
    stop() {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    },
    flush,
    get active() {
      return intervalId != null;
    },
  };
}
