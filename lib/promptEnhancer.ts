import { GenerationPlatform } from "./types";

type PromptEnhancerInput = {
  prompt: string;
  platform: GenerationPlatform;
};

const SKILL_SYSTEM_RULES = [
  "Use a deliberate visual concept with strong hierarchy and non-generic composition.",
  "Prefer shadcn-style structure and semantic HTML patterns for controls and layout.",
  "Use a token mindset for color and spacing decisions (surface, primary, accent, muted).",
  "Keep controls visually clear without relying on animated interactions.",
  "Generate static layouts only: no animations, transitions, keyframes, or motion libraries.",
  "Keep the design faithful to requested scope; never invent unrelated product features.",
];

const PLATFORM_RULES: Record<GenerationPlatform, string[]> = {
  mobile: [
    "Target mobile-first composition with thumb-friendly spacing and readable typography.",
    "Use compact vertical rhythm and avoid oversized desktop-like gutters.",
    "If the requested UI is long or section-heavy, split it into multiple mobile screens instead of one very tall screen.",
    "Name split screens with clear ordered suffixes (for example: Home - 1, Home - 2).",
  ],
  web: [
    "Target desktop web layout with natural full-page vertical flow.",
    "Allow content sections to stack with realistic page height.",
  ],
};

export function buildEnhancedPrompt({
  prompt,
  platform,
}: PromptEnhancerInput): string {
  const cleanedPrompt = prompt.trim();

  return [
    "USER INTENT:",
    cleanedPrompt,
    "",
    "EXECUTION RULES:",
    ...SKILL_SYSTEM_RULES.map((line) => `- ${line}`),
    ...PLATFORM_RULES[platform].map((line) => `- ${line}`),
    "- Do not produce boilerplate template UI unless the prompt explicitly asks for it.",
    "- Do not add features, sections, or data models not requested by the prompt.",
  ].join("\n");
}
