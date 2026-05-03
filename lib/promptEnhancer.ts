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
  "NO PURE BLACK: Never use #000000. Use off-black, zinc-950, or charcoal.",
  "NO GENERIC AI SLOP: No 3-equal-card rows, no generic names, no filler words, no fake numbers",
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
  "Use asymmetric layouts instead of centered symmetry when DESIGN_VARIANCE > 4",
  "Desaturate accents to blend with neutrals; max 1 accent color, saturation < 80%",
  "Use realistic, contextual data: no 'John Doe', 'Acme Corp', '99.99%', or 'Lorem Ipsum'",
  "Implement complete interaction cycles: default, hover, active, focus, disabled for all interactive elements",
];

function inferDesignDials(prompt: string): {
  variance: number;
  motion: number;
  density: number;
} {
  const normalized = prompt.toLowerCase();
  let variance = 8;
  let motion = 6;
  let density = 4;

  if (/(minimal|clean|simple|airy|whitespace)/.test(normalized)) {
    density = 2;
    variance = 3;
  }
  if (/(complex|dense|packed|cockpit|data-heavy)/.test(normalized)) {
    density = 9;
  }
  if (/(chaotic|artsy|experimental|asymmetric|bold)/.test(normalized)) {
    variance = 10;
  }
  if (/(static|still|no animation)/.test(normalized)) {
    motion = 1;
  }
  if (/(cinematic|dynamic|fluid|interactive|magic)/.test(normalized)) {
    motion = 9;
  }

  return { variance, motion, density };
}

function buildDialDirectives(dials: { variance: number; motion: number; density: number }): string[] {
  const directives: string[] = [];

  // DESIGN_VARIANCE (1-10)
  if (dials.variance <= 3) {
    directives.push("Use symmetrical layouts: centered grids, equal spacing, balanced composition.");
  } else if (dials.variance <= 7) {
    directives.push("Use offset layouts: overlapping elements, varied image aspect ratios, left-aligned headers over centered data.");
  } else {
    directives.push("Use asymmetric layouts: masonry, CSS Grid with fractional units (2fr 1fr 1fr), massive empty zones (padding-left: 20vw). Must aggressively fall back to single-column below md:.");
  }

  // MOTION_INTENSITY (1-10)
  if (dials.motion <= 3) {
    directives.push("Static UI: CSS :hover and :active states only. No transitions beyond basic color changes.");
  } else if (dials.motion <= 7) {
    directives.push("Fluid CSS: Use transition-all duration-200 ease-out. Hover lift with -translate-y-[1px]. Focus ring animations.");
  } else {
    directives.push("Advanced choreography: complex scroll-triggered reveals and parallax are NOT available in this static generation. Use static representations of fluid layouts.");
  }

  // VISUAL_DENSITY (1-10)
  if (dials.density <= 3) {
    directives.push("Art Gallery Mode: Lots of whitespace. Huge section gaps (gap-20+). Everything feels expensive and clean.");
  } else if (dials.density <= 7) {
    directives.push("Daily App Mode: Normal spacing for standard web apps. gap-6 to gap-8 between sections.");
  } else {
    directives.push("Cockpit Mode: Tiny paddings. No card boxes; use 1px borders (divide-y) to separate data. Monospace for numbers. Maximize information density.");
  }

  return directives;
}

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
  const dials = inferDesignDials(cleanedPrompt);
  const dialDirectives = buildDialDirectives(dials);

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

  const computedDials = inferDesignDials(cleanedPrompt);
  const computedDialDirectives = buildDialDirectives(computedDials);

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
    "## DESIGN DIALS (Computed from prompt)",
    `- DESIGN_VARIANCE: ${computedDials.variance}/10 (layout asymmetry level)`,
    `- MOTION_INTENSITY: ${computedDials.motion}/10 (interaction richness)`,
    `- VISUAL_DENSITY: ${computedDials.density}/10 (information density)`,
    "",
    "## DESIGN DIAL DIRECTIVES (Apply these to the layout)",
    ...computedDialDirectives.map((line) => `- ${line}`),
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
