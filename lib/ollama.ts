import { createOllama } from "ollama-ai-provider-v2";

export const OLLAMA_BASE =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export function initializeOllama() {
  const ollama = createOllama({
    baseURL: `${OLLAMA_BASE}/api`,
    // compatibility: "strict",
  });

  return ollama;
}

export interface OllamaStreamChunk {
  model: string;
  response: string; // for /api/generate
  message?: { content: string }; // for /api/chat
  done: boolean;
  done_reason?: string;
  eval_count?: number;
  eval_duration?: number;
}

// Non-streaming — for Stage 1 structured JSON extraction
export async function ollamaGenerate(
  model: string,
  prompt: string,
  system: string,
  format?: object, // JSON schema for structured output
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false, // wait for full response
      format: format ?? "json",
      options: {
        temperature: 0.1, // low temp for structured extraction
        num_predict: 1024,
      },
    }),
  });

  if (!res.ok)
    throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.response;
}

// Streaming — for Stage 3 code synthesis, returns the raw Response
export async function ollamaStream(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; num_predict?: number },
): Promise<Response> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.2,
        num_predict: options?.num_predict ?? 4096,
        num_ctx: 8192, // context window — bump for large codegen
      },
    }),
  });

  if (!res.ok) throw new Error(`Ollama stream error: ${res.status}`);
  return res; // return the raw streaming Response
}
