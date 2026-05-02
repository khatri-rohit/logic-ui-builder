import { DesignContext, GenerationPlatform } from "./types";

type PromptEnhancerInput = {
  prompt: string;
  platform: GenerationPlatform;
  designContext?: DesignContext;
};

const CRITICAL_CONSTRAINTS = [
  "CRITICAL: Never use hardcoded colors - use design tokens only (var(--surface), var(--primary), var(--accent))",
  "CRITICAL: Never use arbitrary spacing - use 8pt grid only (gap-2, gap-4, gap-6, gap-8)",
  "CRITICAL: Never use bg-blue-500, text-gray-500, #hex codes directly - use token system",
  "NO EMERGENCY GRADIENTS: Avoid decorative gradients unless explicitly requested",
  "NO EMOJIS: Use Lucide React icons only, never emoji characters",
];

const SKILL_SYSTEM_RULES = [
  "Use a deliberate visual concept with strong hierarchy and non-generic composition.",
  "Use a token mindset for color and spacing decisions (surface, primary, accent, muted).",
  "Keep controls visually clear without relying on animated interactions.",
  "Generate static layouts only: no animations, transitions, keyframes, or motion libraries.",
  "Keep the design faithful to requested scope; never invent unrelated product features.",
  "Apply visual hierarchy: one focal point, then supporting elements, then secondary",
  "Match component selection to content type: Table for data, Grid for cards, List for items",
  "Reference professional UI patterns: Linear (minimal), Stripe (dense), Vercel (whitespace), Notion (calm)",
];

const PLATFORM_RULES: Record<GenerationPlatform, string[]> = {
  mobile: [
    "Target mobile-first composition with thumb-friendly spacing and readable typography.",
    "Use compact vertical rhythm and avoid oversized desktop-like gutters.",
    "If the requested UI is long or section-heavy, split it into multiple mobile screens instead of one very tall screen.",
    "Name split screens with clear ordered suffixes (for example: Home - 1, Home - 2).",
    "Touch targets minimum 44x44px, use gap-3 (12px) for comfortable spacing",
  ],
  web: [
    "Target desktop web layout with natural full-page vertical flow.",
    "Allow content sections to stack with realistic page height.",
    "Use full viewport width on desktop (90%+), not narrow centered columns",
  ],
};

export function buildEnhancedPrompt({
  prompt,
  platform,
  designContext,
}: PromptEnhancerInput): string {
  const cleanedPrompt = prompt.trim();

  const contextRules = designContext
    ? [
        `- Design direction: ${designContext.direction}`,
        `- Recommended style: ${designContext.style.name} (${designContext.style.category})`,
        `- Typography intent: ${designContext.style.typography}`,
        `- Palette direction: ${designContext.palette.name} (${designContext.palette.primaryHex} / ${designContext.palette.accentHex})`,
        `- Layout strategy: ${designContext.layout.name} with ${designContext.layout.visualTreatment}`,
        `- Design Dials: variance=${designContext.designDials.variance}, motion=${designContext.designDials.motion}, density=${designContext.designDials.density}`,
        "- Prioritize these UX checks:",
        ...designContext.uxPriorities.slice(0, 3).map((line) => `  - ${line}`),
        "- Bias corrections (STRICTLY ENFORCED):",
        ...designContext.biasCorrections.slice(0, 5).map((line) => `  - ${line}`),
      ]
    : [];

  return [
    "## PROMPT Framework",
    "- P — Platform: " + (platform === "mobile" ? "mobile (touch-first, 390px viewport)" : "web (desktop-first, 1280px+)"),
    "- R — Role & User: Who is the target user, what is their goal with this UI",
    "- O — Output: Screen type, key elements, specific content to display",
    "- M — Mood & Style: Design style, emotional feeling to convey",
    "- P — Patterns & Components: Navigation pattern, component types to use",
    "- T — Technical: React/Tailwind, accessibility, responsive requirements",
    "",
    "## CRITICAL CONSTRAINTS (ABSOLUTELY ENFORCED)",
    ...CRITICAL_CONSTRAINTS.map((line) => `- ${line}`),
    "",
    "USER INTENT:",
    cleanedPrompt,
    ...(contextRules.length > 0
      ? ["", "## DESIGN CONTEXT:", ...contextRules]
      : []),
    "",
    "## EXECUTION RULES:",
    ...SKILL_SYSTEM_RULES.map((line) => `- ${line}`),
    ...PLATFORM_RULES[platform].map((line) => `- ${line}`),
    "- Do not produce boilerplate template UI unless the prompt explicitly asks for it.",
    "- Do not add features, sections, or data models not requested by the prompt.",
  ].join("\n");
}

export function buildFrameRegeneratePrompt({
  basePrompt,
  prompt,
  screenName,
}: {
  basePrompt: string;
  prompt?: string;
  screenName: string;
}) {
  const normalizedPrompt = prompt?.trim();
  if (!normalizedPrompt) {
    return basePrompt;
  }

  return [
    "## CRITICAL CONSTRAINTS",
    "- CRITICAL: Use design tokens only, never hardcoded colors",
    "- CRITICAL: Use 8pt grid (gap-2, gap-4, gap-6), never arbitrary spacing",
    "",
    basePrompt,
    "",
    "## FRAME MODIFICATION REQUEST:",
    `- Target screen: ${screenName}`,
    "- Apply changes only to this screen while preserving the established design language.",
    "- Maintain design token consistency with other screens.",
    "- Do not introduce new colors or spacing patterns.",
    "",
    "Modification:",
    normalizedPrompt,
  ].join("\n");
}
