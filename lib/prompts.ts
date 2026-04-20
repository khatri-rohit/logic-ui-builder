import { ComponentTreeNode, DesignContext, WebAppSpec } from "./types";

const CREATIVITY_DIRECTIVE = `
Design quality bar (critical):
- Avoid generic or templated layouts.
- Build one clear visual concept per screen with intentional hierarchy.
- Use distinctive typography pairings (no default/system-only look).
- Use a cohesive color system with one dominant direction and sharp accents.
- Keep output purely static: no animations, transitions, or motion effects.
- Build atmosphere with gradients, overlays, patterns, or depth layers.
- Keep accessibility: readable text, semantic landmarks, visible states.
- Keep responsiveness: mobile-first and desktop-ready structure.
`.trim();

const INTENT_LOCK_DIRECTIVE = `
Intent lock (critical):
- Implement only what the user asks for; do not invent features, sections, or flows.
- If details are missing, choose conservative defaults without adding new product scope.
- Keep content and component choices tightly aligned to the prompt intent.
`.trim();

const SKILL_DIRECTIVE = `
Skill-guided UI system:
- Use design-system token logic: clear primitive -> semantic -> component styling structure.
- Keep visual states explicit for controls without animation-driven behavior.
- Avoid repetitive card-grid boilerplate unless explicitly requested.
`.trim();

const STATIC_LAYOUT_DIRECTIVE = `
Static layout mode (critical):
- Generate static design layouts only.
- Do not use animations, transitions, keyframes, or motion libraries.
`.trim();

const COMPILE_GUARDRAILS = `
Compilation guardrails (must pass):
- Output valid TSX only. No markdown, no prose.
- Write one complete component function with balanced (), {}, and [].
- Close every JSX tag and every string/template literal.
- Avoid unsupported syntax and avoid trailing partial lines.
- Use inline mock data inside the file if needed.
- imports allowed; but export the component at the end with: export default GeneratedScreen;
`.trim();

const MOBILE_SPLIT_DIRECTIVE = `
Mobile segmentation (critical):
- For platform = mobile, avoid forcing long, desktop-like pages into one screen.
- If requested content is taller than a typical phone viewport, split into multiple screens.
- Use clear screen names with sequence suffixes, e.g. "Home - 1", "Home - 2", "Checkout - 1", "Checkout - 2".
- Keep each mobile screen focused and scroll length realistic for a handheld UI.
`.trim();

export const STAGE1_SYSTEM = `
You are a Design Architect. Your job is to extract a complete design specification from a user's UI prompt.
Output ONLY valid JSON. No markdown. No explanation. Pure JSON.

Extract the following — think carefully about each field:

{
  "screens": ["string"],
  "navPattern": "top-nav|sidebar|hybrid|none",
  "platform": "web|mobile",
  "colorMode": "dark|light",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "stylingLib": "css|tailwind",
  "layoutDensity": "comfortable|compact",
  "components": ["string"],

  // Design DNA — these fields drive visual quality
  "visualPersonality": "corporate-precision|editorial-bold|minimal-utility|expressive-brand|data-dense|conversational-warm",
  "contentHierarchyDepth": 2|3,
  "dominantLayoutPattern": "full-page-sections|dashboard-grid|sidebar-content|centered-focused|split-screen|data-table-primary",
  "typographyAuthority": "display-driven|body-balanced|data-first|label-dominant",
  "spacingPhilosophy": "airy|balanced|dense",
  "primaryInteraction": "read|navigate|input|browse|monitor",
  "brandPersonality": ["string"],
  "contentDensityScore": 1|2|3|4|5,
  "keyEmotionalTone": "trustworthy|energetic|calm|authoritative|playful|urgent"
}

For visualPersonality: "corporate-precision" = Stripe/Linear style, "editorial-bold" = agency/portfolio, "minimal-utility" = Vercel/Notion, "data-dense" = Bloomberg/analytics, "expressive-brand" = consumer app.
For dominantLayoutPattern: choose what best matches the primary use case.
For typographyAuthority: "display-driven" = big hero text leads, "data-first" = numbers/metrics lead, "label-dominant" = form/settings dense.
`.trim();

export const STAGE2_SYSTEM = `
You are a UI Layout Architect. Given a WebAppSpec with design DNA fields, output a layout blueprint for each screen.
Output ONLY valid JSON array. No markdown. No explanation.

Each screen blueprint must specify layout architecture before listing components:

[{
  "screen": "string",
  "canvasX": number,
  "canvasY": number,
  "components": ["string"],

  // Layout Architecture — the spatial skeleton Stage 3 must follow
  "layoutArchitecture": {
    "outerContainer": "full-bleed|max-w-7xl centered|split-[sidebar-w]px-content|hero-then-sections",
    "primaryGrid": "12-col|8-col|auto-fit-[min]px|single-column|sidebar-[w]px+fluid",
    "sectionBreaks": ["Hero/Above-fold", "Primary Content", "Secondary Content", "CTA/Footer"],
    "fixedElements": ["top-nav 64px", "sidebar 256px"] | [],
    "contentStartOffset": "80px|64px|0px"
  },

  // Component Intent — tells Stage 3 WHY each component is chosen
  "componentIntents": [
    {
      "component": "string",
      "role": "primary-action|navigation|data-display|status-indicator|content-container|input|feedback",
      "spatialWeight": "full-width|half-width|one-third|sidebar|overlay|inline",
      "visualPriority": 1|2|3,
      "interactionType": "clickable|readable|inputable|static"
    }
  ]
}]

Space screens 240px apart horizontally starting at x=60, y=80.
For mobile: x gap 40px. For web dashboards with sidebar: account for 256px sidebar in layout architecture.
`.trim();
const DESIGN_VOCABULARY_DIRECTIVE = `
Design vocabulary you MUST apply (internalize these before writing a single line):

SPATIAL GRAMMAR (8pt grid — all spacing must be multiples of 4px via Tailwind):
  Micro gaps: gap-1(4px) gap-2(8px)       → icon-label pairs, badge clusters
  Element gaps: gap-3(12px) gap-4(16px)   → list items, form fields, inline groups
  Component gaps: gap-6(24px) gap-8(32px) → card groups, section subdivisions  
  Section gaps: gap-12(48px) gap-16(64px) → major content sections
  Hero gaps: gap-20(80px) gap-24(96px)    → above/below fold transitions
  NEVER use arbitrary values like gap-5, p-7, mt-11 unless for specific icon centering.

TYPE SCALE (apply exactly this hierarchy per screen, never invent your own):
  Display: text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]     → hero headlines only
  H1: text-4xl font-bold tracking-tight leading-tight                         → page title
  H2: text-2xl font-semibold tracking-tight                                   → section header
  H3: text-lg font-semibold                                                    → card title, group header
  Body: text-base font-normal leading-relaxed                                  → paragraph content
  UI: text-sm font-medium                                                      → labels, nav items, buttons
  Caption: text-xs font-medium tracking-wide uppercase                         → metadata, timestamps, tags
  RULE: Maximum 3 type levels visible on any single screen section.

COLOR HIERARCHY (derive this system from the two provided hex values):
  Given primaryColor and accentColor, always build:
    surface:         bg-[colorMode == dark ? '#0f0f0f' : '#ffffff']
    surface-elevated: bg-[colorMode == dark ? '#1a1a1a' : '#f8f8f8']  
    surface-border:  opacity 10-15% of foreground
    primary:         provided primaryColor → main CTAs, active states, links
    primary-muted:   primaryColor at 15% opacity → hover backgrounds, selected rows
    accent:          provided accentColor → success states, highlights, badges
    text-primary:    full opacity foreground
    text-secondary:  60% opacity foreground → descriptions, helper text
    text-tertiary:   40% opacity foreground → timestamps, captions
  CRITICAL: Use these semantically. Do not use primary on decorative elements. 
  Do not use text-gray-500 everywhere — use the opacity system.

COMPONENT SELECTION RULES (use these, not your defaults):
  Data comparison (5+ items): <table> with proper thead/tbody, NOT cards
  Data comparison (<5 items): comparison cards with clear value hierarchy
  Form with 5+ fields: two-column layout at lg:, single column at mobile
  Form with 1-4 fields: single column, generous padding
  Navigation (5+ items): sidebar; Navigation (2-4 items): top tabs or segmented control
  Alert/confirmation: inline contextual message, NOT a modal (reserve modals for complex forms)
  Empty states: centered illustration text + primary CTA, never just text
  Loading: skeleton shimmer that matches the layout shape, not spinners

LAYOUT COMPOSITION RULES:
  Dashboard: fixed sidebar (w-64) + scrollable main + sticky top bar (h-16)
  Landing: full-bleed sections with max-w-7xl content container, alternating bg
  Settings/Form: max-w-3xl centered, section dividers, clear save/discard actions
  Data table view: full-width table, filter bar above, pagination below
  Detail view: 2/3 main content + 1/3 sidebar metadata
  RULE: Every screen needs ONE primary focal point. Establish it in the first 200px.

BREATHING ROOM RULES:
  Card internal padding: p-6 minimum (p-4 only for compact/dense mode)
  Section padding: py-12 lg:py-16 for web, py-8 for mobile
  Between sibling cards: gap-4 minimum, gap-6 preferred
  Empty space between major sections: min-h-[1px] bg-border divider OR mb-12 gap
`.trim();

export const STAGE3_SYSTEM = `
You are a world-class product designer who writes their own production-quality code.
You design like the team at Linear, Vercel, or Stripe — opinionated, precise, intentional.
You write code like a senior frontend engineer — semantic, accessible, zero unnecessary complexity.

Your output will be rendered directly in a browser. It must be visually excellent on first render.
No placeholder UI. No "lorem ipsum" sections. No skeleton outlines pretending to be content.
Every component you place has a reason. Every spacing decision follows the 8pt grid.
Every color serves a semantic purpose. Every typographic choice reinforces hierarchy.

${DESIGN_VOCABULARY_DIRECTIVE}

FONT LOADING: Always include this at the top of your component file (before imports) or inside a <style> tag injected via dangerouslySetInnerHTML on a root element:
  Google Fonts: Inter (weights: 400,500,600,700,800) for UI text
  Apply via: style={{ fontFamily: "'Inter', system-ui, sans-serif" }} on the outermost div
  Never rely on system-ui alone.

OUTPUT RULES:
- Standard React + TypeScript only. TSX source code ONLY.
- First non-whitespace character must be a TypeScript token (import, type, interface, const, function, export).
- You MAY import from: recharts, lucide-react, clsx — nothing else.
- Use Tailwind CSS utility classes. CDN Tailwind is available.
- Use explicit className values on EVERY layout, spacing, and typography element.
- No React Native imports. No local file imports (./, ../, @/).
- No UI library imports (no shadcn, no radix, no headlessui) — compose from HTML + Tailwind.
- Generate static layout. No framer-motion, no CSS keyframes, no transition animations.
- Component name: GeneratedScreen. Export: export default GeneratedScreen; at file end.
- Include realistic mock data that makes the UI feel production-ready, not placeholder.
`.trim();

// JSON Schema for WebAppSpec — forces model output into a stable architecture snapshot.
export const WEB_APP_SPEC_SCHEMA = {
  type: "object",
  properties: {
    screens: { type: "array", items: { type: "string" } },
    navPattern: {
      type: "string",
      enum: ["top-nav", "sidebar", "hybrid", "none"],
    },
    platform: { type: "string", enum: ["web", "mobile"] },
    colorMode: { type: "string", enum: ["dark", "light"] },
    primaryColor: { type: "string" },
    accentColor: { type: "string" },
    stylingLib: { type: "string", enum: ["css", "tailwind"] },
    layoutDensity: { type: "string", enum: ["comfortable", "compact"] },
  },
  required: [
    "screens",
    "navPattern",
    "platform",
    "colorMode",
    "stylingLib",
    "layoutDensity",
  ],
};

// Backward-compatible export name while call sites migrate.
export const MOBILE_SPEC_SCHEMA = WEB_APP_SPEC_SCHEMA;

export function buildScreenPrompt(
  spec: WebAppSpec & {
    visualPersonality?: string;
    dominantLayoutPattern?: string;
    typographyAuthority?: string;
    spacingPhilosophy?: string;
    keyEmotionalTone?: string;
    contentDensityScore?: number;
  },
  tree: ComponentTreeNode[],
  screen: string,
  userPrompt: string,
  designContext?: DesignContext,
): string {
  const node = tree.find((n) => n.screen === screen) as
    | (ComponentTreeNode & {
        layoutArchitecture?: Record<string, unknown>;
        componentIntents?: unknown[];
      })
    | undefined;
  const components = node?.components ?? [];
  const layoutArch = node?.layoutArchitecture;
  const componentIntents = node?.componentIntents ?? [];

  const isDark = spec.colorMode === "dark";
  const isMobile = spec.platform === "mobile";

  // Derive semantic token system from the two provided colors
  const tokenSystem = `
DESIGN TOKENS FOR THIS SCREEN (inject as CSS vars or direct Tailwind, use semantically):
  --surface:          ${isDark ? "#0f0f0f" : "#ffffff"}
  --surface-elevated: ${isDark ? "#1a1a1a" : "#f5f5f5"}  
  --surface-overlay:  ${isDark ? "#242424" : "#eeeeee"}
  --border:           ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}
  --border-focus:     ${spec.primaryColor}40
  --text-primary:     ${isDark ? "#f0f0f0" : "#0a0a0a"}
  --text-secondary:   ${isDark ? "rgba(240,240,240,0.60)" : "rgba(10,10,10,0.60)"}
  --text-tertiary:    ${isDark ? "rgba(240,240,240,0.38)" : "rgba(10,10,10,0.38)"}
  --primary:          ${spec.primaryColor}
  --primary-muted:    ${spec.primaryColor}22
  --accent:           ${spec.accentColor}
  --accent-muted:     ${spec.accentColor}22

Apply as: bg-[var(--surface)], text-[var(--text-secondary)], border-[var(--border)], etc.
OR use equivalent Tailwind: bg-neutral-950, text-neutral-400, border-white/10 (for dark).
`.trim();

  const layoutDirective = layoutArch
    ? `
MANDATORY LAYOUT ARCHITECTURE (do not deviate from this skeleton):
  Outer container: ${layoutArch.outerContainer}
  Primary grid: ${layoutArch.primaryGrid}
  Section structure: ${(layoutArch.sectionBreaks as string[])?.join(" → ")}
  Fixed UI elements: ${(layoutArch.fixedElements as string[])?.join(", ") || "none"}
  Content start offset: ${layoutArch.contentStartOffset}
`
    : "";

  const designBrief = `
DESIGN BRIEF FOR: "${screen}"
  Visual personality: ${spec.visualPersonality || "minimal-utility"}
  Emotional tone: ${spec.keyEmotionalTone || "trustworthy"}  
  Layout pattern: ${spec.dominantLayoutPattern || "dashboard-grid"}
  Typography authority: ${spec.typographyAuthority || "body-balanced"}
  Spacing philosophy: ${spec.spacingPhilosophy || "balanced"} (${spec.contentDensityScore || 3}/5 density)
  Platform: ${isMobile ? "Mobile — 390px viewport, touch-first, thumb-zone CTAs" : "Web — desktop-first, 1280px+ viewport"}
  Color mode: ${isDark ? "Dark — use depth layers, not pure black" : "Light — clean whites, precise shadows"}

Reference benchmarks to match quality level:
${spec.dominantLayoutPattern === "dashboard-grid" ? "  → Linear dashboard: tight grid, no wasted space, every metric has context\n  → Vercel project view: status + recency at a glance, clean data hierarchy" : ""}
${spec.dominantLayoutPattern === "full-page-sections" ? "  → Stripe homepage: each section has one job, generous whitespace, precise type\n  → Linear's marketing: bold headlines, subtle grids, confident empty space" : ""}
${spec.dominantLayoutPattern === "data-table-primary" ? "  → Notion database: column density without feeling cramped, row hover states\n  → Stripe dashboard: financial data that reads clearly at a glance" : ""}
`.trim();

  const componentPlan =
    componentIntents.length > 0
      ? `
COMPONENT PLACEMENT PLAN (follow this intent exactly):
${(
  componentIntents as Array<{
    component: string;
    role: string;
    spatialWeight: string;
    visualPriority: number;
    interactionType: string;
  }>
)
  .map(
    (intent) =>
      `  ${intent.visualPriority}. ${intent.component} → role: ${intent.role}, weight: ${intent.spatialWeight}, interaction: ${intent.interactionType}`,
  )
  .join("\n")}
`
      : `Components to include: ${components.map((c) => `${c}`).join(", ")}`;

  const antiPatterns = `
ANTI-PATTERNS — if you find yourself writing any of these, stop and redesign:
  ✗ Three equal-sized KPI cards with identical visual weight  → vary size, add trend context
  ✗ Full-width gray dividers between every section            → use spacing + typography contrast instead
  ✗ "Lorem ipsum" or obviously fake data                     → use domain-realistic mock data
  ✗ text-gray-500 for all secondary text                    → use the token system above
  ✗ Every button primary style                               → use hierarchy: primary, secondary, ghost
  ✗ p-4 on every element                                     → follow the spatial grammar rules
  ✗ Single column form at desktop width                      → two columns at lg: for 5+ fields
  ✗ Centered narrow content column on dashboard screens      → dashboards need full-width composition
`.trim();

  const designContextBlock = designContext
    ? `
SKILL-DERIVED CONTEXT:
  Style: ${designContext.style.name} | Typography: ${designContext.style.typography}
  Palette: ${designContext.palette.name} | Psychology: ${designContext.palette.psychology}
  Layout: ${designContext.layout.name} — ${designContext.layout.cssStructure}
  Top UX constraint: ${designContext.uxPriorities[0] || "Accessible contrast ratios and visible focus states"}
`
    : "";

  return `
Generate a complete, production-quality React component for screen: "${screen}"

USER INTENT: ${userPrompt}

${designBrief}

${tokenSystem}

${layoutDirective}

${componentPlan}

${designContextBlock}

${antiPatterns}

SYNTAX REQUIREMENTS:
  - Component name: GeneratedScreen
  - Include Inter font: add style={{ fontFamily: "'Inter', system-ui, sans-serif" }} to root element
  - Include realistic mock data (minimum 4-6 data points for any list/table)
  - Close all JSX tags, balance all brackets and delimiters
  - Final line: export default GeneratedScreen;
  - Output code ONLY — no explanation text before or after
`.trim();
}
