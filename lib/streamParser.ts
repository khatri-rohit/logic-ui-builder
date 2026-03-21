// Takes Ollama's NDJSON ReadableStream,
// returns a new ReadableStream that emits proper SSE lines
export function ollamaToSSE(
  ollamaBody: ReadableStream<Uint8Array>,
  onChunk?: (token: string) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream({
    async start(controller) {
      const reader = ollamaBody.getReader()
      let buffer = ''    // CRITICAL: buffer for partial lines

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // flush any remaining buffer
            if (buffer.trim()) {
              tryParseLine(buffer, controller, encoder, onChunk)
            }
            // send SSE done sentinel
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            break
          }

          // Decode bytes → string and append to buffer
          buffer += decoder.decode(value, { stream: true })

          // Split on newlines — last element may be incomplete
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''   // keep incomplete last line

          for (const line of lines) {
            if (!line.trim()) continue
            tryParseLine(line, controller, encoder, onChunk)
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        )
        controller.close()
      }
    }
  })
}

function tryParseLine(
  line: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  onChunk?: (token: string) => void
) {
  try {
    const obj = JSON.parse(line)

    // /api/chat puts content in message.content
    // /api/generate puts it in response
    const token = obj.message?.content ?? obj.response ?? ''

    if (token) {
      onChunk?.(token)
      // Re-emit as proper SSE format
      const ssePayload = JSON.stringify({ token, done: false })
      controller.enqueue(encoder.encode(`data: ${ssePayload}\n\n`))
    }

    if (obj.done) {
      const donePayload = JSON.stringify({
        done: true,
        eval_count: obj.eval_count,
        eval_duration: obj.eval_duration,
      })
      controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`))
    }
  } catch {
    // malformed JSON line — skip silently in production, log in dev
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ollama] malformed line:', line)
    }
  }
}