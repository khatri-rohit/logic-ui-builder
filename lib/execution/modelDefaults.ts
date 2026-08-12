/**
 * Shared model priority lists and per-stage decoding for generation Stage 1–3.
 * Both POST /api/generate and POST /api/generate/[frameId] must use these.
 */
export const STAGE1_MODELS = [
  "deepseek-v4-flash:cloud",
  "glm-5.2:cloud",
  "gemma4:31b",
] as const;

export const STAGE2_MODELS = [
  "glm-5.2:cloud",
  "deepseek-v4-flash:cloud",
] as const;

export const STAGE3_MODELS = [
  "glm-5.2:cloud",
  "deepseek-v4-flash:cloud",
  "gemma4:31b",
  "gpt-oss:120b-cloud",
] as const;

export type GenerationDecodingStage =
  | "stage1"
  | "stage2"
  | "stage3_first"
  | "stage3_sibling"
  | "stage3_retry"
  | "frame_regen";

export interface StageDecoding {
  temperature: number;
  maxOutputTokens: number;
}

const STAGE_DECODING: Record<GenerationDecodingStage, StageDecoding> = {
  stage1: { temperature: 0.1, maxOutputTokens: 2048 },
  stage2: { temperature: 0.1, maxOutputTokens: 3072 },
  stage3_first: { temperature: 0.2, maxOutputTokens: 8192 },
  stage3_sibling: { temperature: 0.12, maxOutputTokens: 8192 },
  stage3_retry: { temperature: 0.0, maxOutputTokens: 8192 },
  frame_regen: { temperature: 0.15, maxOutputTokens: 8192 },
};

export function getStageDecoding(
  stage: GenerationDecodingStage,
): StageDecoding {
  return STAGE_DECODING[stage];
}

export function getStage3Decoding(options: {
  hasReference: boolean;
  isValidationRetry: boolean;
  isFrameRegen: boolean;
}): StageDecoding {
  if (options.isValidationRetry) {
    const base = options.isFrameRegen
      ? STAGE_DECODING.frame_regen
      : options.hasReference
        ? STAGE_DECODING.stage3_sibling
        : STAGE_DECODING.stage3_first;
    return {
      temperature: STAGE_DECODING.stage3_retry.temperature,
      maxOutputTokens: base.maxOutputTokens,
    };
  }

  if (options.isFrameRegen) {
    return STAGE_DECODING.frame_regen;
  }

  return options.hasReference
    ? STAGE_DECODING.stage3_sibling
    : STAGE_DECODING.stage3_first;
}
