/**
 * Shared model priority lists for generation Stage 1–3.
 * Both POST /api/generate and POST /api/generate/[frameId] must use these.
 */
export const STAGE1_MODELS = [
  "deepseek-v4-flash:cloud",
  "glm-5.2:cloud",
  "gemma4:31b",
] as const;

export const STAGE2_MODELS = ["deepseek-v4-flash:cloud"] as const;

export const STAGE3_MODELS = [
  "glm-5.2:cloud",
  "deepseek-v4-flash:cloud",
  "gemma4:31b",
  "gpt-oss:120b-cloud",
] as const;
