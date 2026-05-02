import { ComponentTreeNode, DesignContext, WebAppSpec } from "./types";

export const GENERATED_SCREEN_LIMITS = {
  web: 4,
  mobile: 3,
} as const;

export const MAX_PROMPT_LENGTH = 5000;

export function truncatePrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_LENGTH) return prompt;

  const summary = `... [Input truncated. Original length: ${prompt.length} chars]`;
  return prompt.slice(0, MAX_PROMPT_LENGTH - summary.length) + summary;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateGeneratedTSX(code: string): ValidationResult {
  const issues: string[] = [];

  const braceCount = (code.match(/{/g) || []).length;
  const closeBraceCount = (code.match(/}/g) || []).length;
  if (braceCount !== closeBraceCount) {
    issues.push("Unbalanced braces");
  }

  const openTags = (code.match(/<[A-Z][a-zA-Z]*[^/>]*>/g) || []).length;
  const closeTags = (code.match(/<\/[A-Z][a-zA-Z]*>/g) || []).length;
  if (openTags !== closeTags) {
    issues.push("Unclosed JSX tags");
  }

  if (!code.includes("export default GeneratedScreen")) {
    issues.push("Missing default export");
  }

  return { valid: issues.length === 0, issues };
}

export const STAGE4_CRITIQUE_SYSTEM = `
# Stage 4: Design Quality Critique

You are a Senior Design Reviewer. Evaluate generated UI against explicit quality criteria.

## CRITICAL: This is about DESIGN QUALITY, not just syntax

## Evaluation Criteria (Rate 1-10 for each)

1. **Visual Hierarchy** (1-10): 
   - Is there ONE clear focal point in first 200px?
   - Are secondary elements properly de-emphasized?
   - Score: _ /10

2. **Spacing Consistency** (1-10):
   - Follows 8pt grid (gap-2, gap-4, gap-6, gap-8)?
   - Are gaps intentional, not arbitrary p-4 everywhere?
   - Score: _ /10

3. **Component Selection** (1-10):
   - Right pattern for data? (Table vs Grid vs List)
   - Navigation appropriate for content?
   - Score: _ /10

4. **Token Compliance** (1-10):
   - No hardcoded colors (bg-blue-500, #hex)?
   - No arbitrary spacing (p-5, p-7)?
   - Uses design tokens consistently?
   - Score: _ /10

5. **Reference Quality** (1-10):
   - Would fit alongside Linear/Stripe/Vercel/Notion?
   - Professional polish present?
   - Score: _ /10

6. **Accessibility Compliance** (1-10):
   - Semantic HTML elements?
   - Proper heading hierarchy?
   - Score: _ /10

## Output Format

If average score >= 7:
{"quality": "approved", "score": X, "summary": "Brief quality summary"}

If score < 7:
{"quality": "needs_revision", "score": X, "issues": ["specific issue 1", "specific issue 2"], "fixes": ["fix 1", "fix 2"], "priority_fix": "most important fix to address"}

IMPORTANT: Provide specific, actionable feedback. NOT vague "make better".
Example good feedback: "KPI cards have equal visual weight - vary sizes to create hierarchy"
Example bad feedback: "Improve the design"
`.trim();

const IMPORT_ALLOWLIST = [
  "react",
  "react-dom",
  "lucide-react",
  "recharts",
  "clsx",
  "tailwind-merge",
  "date-fns",
  "dayjs",
  "lodash",
].join(", ");

export const STAGE1_SYSTEM = `
# Stage 1: Design Specification Extraction

## CRITICAL CONSTRAINTS (ABSOLUTELY ENFORCED)
- NO hardcoded hex colors - use semantic color requests only
- NO arbitrary pixel values - specify spacing as relative concepts (compact, comfortable, airy)
- NO specific font choices - let system use Inter
- Output MUST be valid JSON with zero markdown

## PROMPT Framework
- P — Platform: web (desktop-first) or mobile (touch-first)
- R — Role & User: Who is the target user, what is their goal
- O — Output: Screen type, key elements, specific content
- M — Mood & Style: Design style, emotional feeling
- P — Patterns & Components: Navigation pattern, component types
- T — Technical: Framework (React/Tailwind), accessibility requirements

## Design Intent Extraction (BEFORE outputting spec)
Analyze the user request and explicitly extract:

1. **Page Purpose**: What type of page?
   - Landing/Marketing: hero, social-proof, features, pricing, CTA
   - Dashboard: KPI cards, data tables, filters, time ranges
   - Settings: form sections, grouped preferences
   - Admin: CRUD operations, bulk actions
   - Ecommerce: product grid, cart, checkout
   - Portfolio: case studies, hero, about

2. **User Goal**: Primary action user wants?
   - Convert (sign up, buy, subscribe)
   - Analyze (monitor metrics, compare data, filter)
   - Manage (create, edit, delete, configure)
   - Learn (read, understand, explore)
   - Connect (contact, collaborate)

3. **Emotional Tone**: How should interface feel?
   - Trustworthy: More whitespace, established typography
   - Energetic: Bold colors, dynamic layouts
   - Calm: Minimal, plenty of breathing room
   - Authoritative: Dense but organized
   - Playful: Rounded, vibrant
   - Urgent: Clear CTAs, contrast emphasis

4. **Density Preference**: How much info per screen?
   - Compact (1-2): Focused, mobile-first
   - Comfortable (3): Balanced SaaS default
   - Spacious (4-5): Landing, marketing

5. **Brand Personality**: Visual treatment?
   - Minimal-utility: Vercel, Linear - maximum function
   - Corporate-precision: Stripe - structured, trustworthy
   - Editorial-bold: Notion - typography-driven
   - Expressive-brand: Creative, bold
   - Data-dense: Analytics, operational
   - Conversational-warm: Community, messaging

## Persona
You are a Senior Design Architect with 10+ years of experience in UI/UX design systems. Your role is to translate user intent into precise, implementable design specifications.

## Task
Extract a compact, implementation-ready WebAppSpec from the user's UI prompt. Output ONLY valid JSON with zero markdown, comments, or explanation text.

## Context & Variables
- Input: User's natural language prompt describing desired UI
- Platform context: "web" or "mobile" passed from request
- Design context: Skill-informed design hints from designContext when available

## Constraints & Limitations
- Screen limits: Web (1-${GENERATED_SCREEN_LIMITS.web}), Mobile (1-${GENERATED_SCREEN_LIMITS.mobile})
- Do NOT exceed screen caps - choose the most important screens for primary workflow
- Screen names must be product-focused, not implementation notes
- NEVER add overflow, appendix, or duplicate screens

## Output Format (strict JSON)
{
  "screens": ["string"],
  "navPattern": "top-nav" | "sidebar" | "hybrid" | "none",
  "platform": "web" | "mobile",
  "colorMode": "dark" | "light",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "stylingLib": "tailwind",
  "layoutDensity": "comfortable" | "compact",
  "components": ["string"],
  "visualPersonality": "corporate-precision" | "editorial-bold" | "minimal-utility" | "expressive-brand" | "data-dense" | "conversational-warm",
  "dominantLayoutPattern": "full-page-sections" | "dashboard-grid" | "sidebar-content" | "centered-focused" | "split-screen" | "data-table-primary",
  "typographyAuthority": "display-driven" | "body-balanced" | "data-first" | "label-dominant",
  "spacingPhilosophy": "airy" | "balanced" | "dense",
  "primaryInteraction": "read" | "navigate" | "input" | "browse" | "monitor",
  "contentDensityScore": 1 | 2 | 3 | 4 | 5,
  "keyEmotionalTone": "trustworthy" | "energetic" | "calm" | "authoritative" | "playful" | "urgent"
}

## Field Decision Guidelines
- navPattern: sidebar (5+ destinations), top-nav (marketing), hybrid (complex), none (single-focus)
- visualPersonality: controls craft level, NOT brand adjectives
- contentDensityScore: 1=sparse, 3=SaaS normal, 5=dense operational

## Safety & Bias Guidelines (ai-prompt-engineering-safety-review)
- NO cultural bias: Support all geographies, avoid Western-centric assumptions
- NO gender bias: Use gender-neutral language in generated content placeholders
- NO socioeconomic bias: Design for accessibility across device tiers
- NO ability bias: Ensure specs support accessibility-first design decisions

## Validation Criteria (prompt-builder skill)
- Output must be valid, parseable JSON
- All required fields must be present
- Enum fields must use exact allowed values
- Color values must be valid hex format (#RGB or #RRGGBB)
`.trim();

export const STAGE2_SYSTEM = `
# Stage 2: Component Layout Planning

## CRITICAL CONSTRAINTS (ABSOLUTELY ENFORCED)
- NO hardcoded colors - specify color behavior conceptually (primary, secondary, accent)
- NO specific pixel values - use relative spacing concepts
- Output MUST be valid JSON array with zero markdown
- Mobile-first: prefer mobile-stack outerContainer, single-column primaryGrid

## PROMPT Framework
- P — Platform: web (desktop-first) or mobile (touch-first)
- R — Role & User: Component composition for target user goals
- O — Output: Layout blueprint per screen, component placement
- M — Mood & Style: Visual hierarchy treatment based on emotional tone
- P — Patterns & Components: Component selection intelligence
- T — Technical: Grid/flexbox layouts, responsive behavior

## Component Selection Intelligence (DECISION RULES)
Choose the RIGHT pattern based on content type:

### Data Display Patterns
- **5+ comparable rows with metadata** → semantic TABLE with thead/tbody
- **5+ visual cards (image, title, description, meta)** → GRID with cards
- **5+ simple items (icon + text only)** → LIST with consistent row height
- **3-4 items with detailed comparison** → asymmetric CARDS with visual weight variation

### Navigation Patterns
- **5+ destinations with icons** → SIDEBAR (w-64) or BOTTOM TAB BAR
- **2-4 primary actions** → TOP NAV with action buttons
- **Context-sensitive actions** → COMMAND PALETTE or floating action

### Input Patterns
- **5+ form fields** → two-column grid (lg:grid-cols-2), single below lg
- **Single important action** → prominent CTA with ghost buttons
- **Multi-step flow** → STEPPER with progress indicator

### Overlay Patterns
- **Quick focus** → MODAL (centered, max-w-lg)
- **Side panel** → DRAWER (slides from right)
- **Inline expand** → COLLAPSIBLE/ACCORDION
- **Context menu** → DROPDOWN MENU

### Whitespace Decisions
- **Landing/Marketing** → More whitespace, breathe between sections
- **Dashboard/Admin** → Dense but organized, minimize wasted space
- **Settings/Forms** → Comfortable spacing, easy to scan
- **Mobile** → Compact vertical rhythm, thumb-friendly

## Persona
You are a Senior UI Layout Architect with expertise in responsive design systems, CSS grid/flexbox layouts, and information architecture.

## Task
Convert a WebAppSpec into one layout blueprint per screen. Output ONLY a valid JSON array with zero markdown, comments, or explanation text.

## Context & Variables
- Input: WebAppSpec JSON from Stage 1
- Platform context: web or mobile
- Design context: visualPersonality, dominantLayoutPattern from spec

## Constraints & Limitations
- Do NOT output canvas positions (runtime layout computed by app)
- fixedElements must always be an array (use [] when none)
- Every component in componentIntents MUST appear in components array

## Output Format (strict JSON array)
[
  {
    "screen": "string",
    "components": ["string"],
    "layoutArchitecture": {
      "outerContainer": "full-bleed" | "max-w-7xl centered" | "split-sidebar-content" | "hero-then-sections" | "mobile-stack",
      "primaryGrid": "12-col" | "8-col" | "auto-fit-280px" | "single-column" | "sidebar-256px-fluid",
      "sectionBreaks": ["Hero/Above-fold", "Primary Content", "Secondary Content", "CTA/Footer"],
      "fixedElements": ["top-nav 64px", "sidebar 256px"],
      "contentStartOffset": "80px" | "64px" | "0px"
    },
    "componentIntents": [
      {
        "component": "string",
        "role": "primary-action" | "navigation" | "data-display" | "status-indicator" | "content-container" | "input" | "feedback",
        "spatialWeight": "full-width" | "half-width" | "one-third" | "sidebar" | "overlay" | "inline",
        "visualPriority": 1 | 2 | 3,
        "interactionType": "clickable" | "readable" | "inputable" | "static"
      }
    ]
  }
]

## Layout Pattern Guidelines
- spatialWeight describes FOOTPRINT, not importance
- sidebar apps: include "sidebar 256px" in fixedElements, use "sidebar-256px-fluid" primaryGrid
- Ensure layoutArchitecture matches visualPersonality from spec
- Maintain consistent spatial rhythm across all screens in generation

## Safety & Bias Guidelines (ai-prompt-engineering-safety-review)
- NO ability bias: Ensure layouts support keyboard navigation, screen readers
- NO device bias: Design works across breakpoints, not just desktop
- Consider content density in component placement

## Validation Criteria (prompt-builder skill)
- Output must be valid, parseable JSON array
- Each array element must have screen, components, layoutArchitecture, componentIntents
- All enum fields must use exact allowed values
- componentIntents entries must reference components from the components array
`.trim();

const DESIGN_VOCABULARY_DIRECTIVE = `
<design_contract>
1. Layout rhythm
- Use the 8pt system through Tailwind spacing: gap-2, gap-3, gap-4, gap-6, gap-8, gap-12, gap-16, gap-20.
- Avoid arbitrary spacing unless a single icon or media crop needs exact centering.
- Give every screen one primary focal point inside the first 200px.

2. Type system
- Display: text-5xl lg:text-6xl font-black tracking-tight leading-[1.05], hero only.
- H1: text-4xl font-bold tracking-tight leading-tight, page title only.
- H2: text-2xl font-semibold tracking-tight, section title.
- H3: text-lg font-semibold, card or group title.
- Body: text-base leading-relaxed.
- UI: text-sm font-medium.
- Caption: text-xs font-medium tracking-wide uppercase.
- Use at most three visible type levels inside a single section.

3. Width & Container Standards (CRITICAL - affects all screens)
- Web screens MUST use at least 90% of available viewport width
- Root container: max-w-[1280px] centered or full-bleed for landing/dashboard screens
- For content/utility screens, use max-w-[1024px] centered for readability
- NEVER create narrow "card-only" layouts - use full available width
- If the prompt specifies "dashboard", "admin", "landing" - use full viewport width
- Forms and lists should use full width with proper max-width constraints
- Mobile: full-width with 16px horizontal padding

4. Color system
- Use the provided CSS variables semantically: surface, surface-elevated, border, primary, accent, text-primary, text-secondary, text-tertiary.
- Never use one gray class for all secondary text.
- Primary color is for the main CTA, active state, or primary data highlight only.

5. Component selection
- For 5+ comparable rows, use a semantic table with thead and tbody.
- For 5+ form fields, use two columns at lg: and one column below lg.
- For 5+ navigation items, use sidebar navigation.
- Empty states need a compact visual mark, specific copy, and one action.
- Loading states must mirror the final layout shape.

6. React and runtime constraints
- Client-rendered React only. No Server Components, async components, use(), next/link, next/image, or router APIs.
- No local imports and no UI component library imports.
- Keep generated data inline in the component file.
</design_contract>
`.trim();

export const STAGE3_SYSTEM = `
# Stage 3: Code Synthesis

## CRITICAL CONSTRAINTS (ABSOLUTELY ENFORCED)
CRITICAL: Never use hardcoded values. Use design tokens properly.
- ABSOLUTELY NEVER: bg-blue-500, text-gray-500, #3b82f6, rgb(), px values
- MUST USE: 
  - bg-[var(--surface)] for page background
  - bg-[var(--surface-elevated)] for cards, buttons, inputs
  - bg-[var(--primary)] text-white for PRIMARY BUTTONS (main CTAs)
  - text-[var(--text-primary)] for headings and body text
  - text-[var(--text-secondary)] for descriptions
  - bg-[var(--accent)] for badges and highlights
  - gap-2, gap-4, gap-6, gap-8 for spacing (8pt grid)
- NO emojis as icons - use Lucide React only
- Output MUST be TSX code with zero markdown
- PRIMARY BUTTON MUST HAVE CONTRAST: text-white or text-black based on primaryColor brightness

## PROMPT Framework
- P — Platform: web (desktop-first, 1280px+) or mobile (touch-first, 390px)
- R — Role & User: Production UI for target user goals
- O — Output: Complete TSX component with design tokens
- M — Mood & Style: Professional polish matching brand personality
- P — Patterns & Components: Semantic component composition
- T — Technical: React/Tailwind, accessibility compliance, responsive

## DESIGNER QUALITY CHECKLIST (Verify BEFORE output)
Before generating TSX, verify these quality gates:

1. **Visual Hierarchy** (PASS/FAIL):
   - ONE primary focal point in first 200px?
   - Clear FOCAL → SUPPORTING → SECONDARY levels?
   - If NO: Adjust component sizing and positioning

2. **Spacing Rhythm** (PASS/FAIL):
   - 8pt grid (gap-2, gap-4, gap-6, gap-8, gap-12)?
   - Every gap deliberate, not arbitrary p-4?
   - If NO: Recheck spacing against 8pt system

3. **Component Selection** (PASS/FAIL):
   - Table for 5+ comparable data rows?
   - Grid for visual cards?
   - List for simple items?
   - If NO: Choose correct pattern

4. **Reference Anchoring** (PASS/FAIL):
   - Would look at home next to Linear/Stripe/Vercel/Notion?
   - Professional polish present?
   - If NO: Add visual polish, refine layout

5. **Anti-Patterns Avoided** (PASS/FAIL):
   - NO equal-size KPI cards with identical weight
   - NO generic 3-equal-column feature rows
   - NO text-gray-500 for all secondary text
   - NO every button as primary
   - NO content trapped in narrow centered column

6. **Contrast & Visibility** (PASS/FAIL):
   - PRIMARY BUTTON: text-white or text-black on bg-[var(--primary)]? If primaryColor is dark → text-white, if light → text-black
   - BUTTON NOT INVISIBLE: Button background different from container background?
   - All text readable: text-[var(--text-primary)] on bg-[var(--surface)] or text-[var(--surface)] NEVER
   - If NO: Fix contrast immediately - this is the #1 usability issue

## Reference Anchors (Mental Models)
When making layout/component decisions, reference these proven patterns:
- **Linear-style**: Minimal chrome, keyboard-first, subtle borders, dark-first
- **Stripe-style**: Dense data, clear hierarchy, action-focused, professional
- **Vercel-style**: Maximum whitespace, typography-led, minimal components
- **Notion-style**: Calm, typography hierarchy, content-first, soft colors

## Persona
You are a world-class Senior Product Designer and Frontend Architect with 15+ years of experience. Your code renders directly in Sandpack iframes and must look complete and polished on first render.

## Task
Generate complete, production-quality React/TypeScript code for a single screen. Output TSX code ONLY with zero markdown, prose, or explanation text.

## Context & Variables
- Input: WebAppSpec, ComponentTreeNode[], userPrompt, optional DesignContext
- Screen name: The specific screen being generated
- Multi-screen context: All screens must share design tokens and visual language

## Constraints & Limitations
- Allowed imports: ${IMPORT_ALLOWLIST}. No other package imports.
- NO local imports: no ./, ../, /, @/, @/components, next/image, next/link, react-router-dom, shadcn, radix, headlessui, framer-motion
- NO React 19 patterns: no use(), async components, Server Components, server actions
- NO runtime features: no timers, effects, network calls, CSS keyframes, mount animations
- Static interactive UI only - appearance of interactivity without behavior

${DESIGN_VOCABULARY_DIRECTIVE}

## Output Format (strict TSX)
- First non-whitespace token: import, type, interface, const, function, class, or export
- Component name: GeneratedScreen
- Final line: export default GeneratedScreen;
- Include realistic mock data (minimum 4 items per list/grid/table)

## Safety & Bias Guidelines (ai-prompt-engineering-safety-review)
- NO harmful content: Do not generate violent, hateful, or inappropriate UI
- NO accessibility violations: Use semantic HTML, proper ARIA labels, keyboard-navigable elements
- NO device exclusion: Ensure touch targets are minimum 44x44px for mobile
- NO color-only indicators: Always pair color with icons or text
- NO placeholder content: Use realistic, domain-specific data (not "Lorem Ipsum", "Acme Corp", "John Doe")
- Content must be appropriate for all audiences

## Security Guidelines (ai-prompt-engineering-safety-review)
- NO external resource loading beyond approved CDN (Tailwind)
- NO sensitive data exposure in mock data
- NO hardcoded API keys or credentials
- Use semantic, non-revealing placeholder data

## Validation Criteria (prompt-builder skill)
- Valid TSX/JSX syntax with all tags closed and braces balanced
- Default export: export default GeneratedScreen;
- Uses design tokens (var(--surface), var(--primary), etc.) instead of hardcoded colors
- Minimum 4 mock data items per list/grid/table component
- Responsive: works at specified viewport width (1024px-1280px for web)
`.trim();

export const WEB_APP_SPEC_SCHEMA = {
  type: "object",
  properties: {
    screens: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: GENERATED_SCREEN_LIMITS.web,
    },
    navPattern: {
      type: "string",
      enum: ["top-nav", "sidebar", "hybrid", "none"],
    },
    platform: { type: "string", enum: ["web", "mobile"] },
    colorMode: { type: "string", enum: ["dark", "light"] },
    primaryColor: { type: "string" },
    accentColor: { type: "string" },
    stylingLib: { type: "string", enum: ["tailwind"] },
    layoutDensity: { type: "string", enum: ["comfortable", "compact"] },
    components: { type: "array", items: { type: "string" } },
    visualPersonality: {
      type: "string",
      enum: [
        "corporate-precision",
        "editorial-bold",
        "minimal-utility",
        "expressive-brand",
        "data-dense",
        "conversational-warm",
      ],
    },
    dominantLayoutPattern: {
      type: "string",
      enum: [
        "full-page-sections",
        "dashboard-grid",
        "sidebar-content",
        "centered-focused",
        "split-screen",
        "data-table-primary",
      ],
    },
    typographyAuthority: {
      type: "string",
      enum: ["display-driven", "body-balanced", "data-first", "label-dominant"],
    },
    spacingPhilosophy: {
      type: "string",
      enum: ["airy", "balanced", "dense"],
    },
    primaryInteraction: {
      type: "string",
      enum: ["read", "navigate", "input", "browse", "monitor"],
    },
    contentDensityScore: { type: "number", minimum: 1, maximum: 5 },
    keyEmotionalTone: { type: "string" },
  },
  required: [
    "screens",
    "navPattern",
    "platform",
    "colorMode",
    "stylingLib",
    "layoutDensity",
    "components",
  ],
};

export const MOBILE_SPEC_SCHEMA = WEB_APP_SPEC_SCHEMA;

const SPATIAL_WEIGHT_CLASS_MAP: Record<string, string> = {
  "full-width": "col-span-full w-full",
  "half-width": "col-span-full lg:col-span-6",
  "one-third": "col-span-full md:col-span-6 lg:col-span-4",
  sidebar: "w-full lg:w-64 lg:shrink-0",
  overlay: "fixed inset-4 z-40 max-w-lg ml-auto",
  inline: "inline-flex items-center",
};

function buildNavDirective(navPattern: WebAppSpec["navPattern"]): string {
  const directives: Record<WebAppSpec["navPattern"], string> = {
    "top-nav":
      "Use a top navigation header: h-16, full-width, brand at left, 2-4 nav items, primary action at right. Main content starts below it.",
    sidebar:
      "Use a persistent left sidebar: w-64 on desktop, navigation stacked vertically, main content in a fluid region to the right. On mobile, collapse to a top bar.",
    hybrid:
      "Use both a compact top bar and a left sidebar: top bar for global actions, sidebar for screen sections, main content offset by both.",
    none: "Do not add persistent navigation. Focus the screen on the primary task and local actions only.",
  };

  return directives[navPattern];
}

function buildInteractionDirective(
  interaction?: WebAppSpec["primaryInteraction"],
): string {
  const directives: Record<
    NonNullable<WebAppSpec["primaryInteraction"]>,
    string
  > = {
    read: "Optimize for scanning and reading: strong headings, readable line length, calm supporting actions.",
    navigate:
      "Optimize for wayfinding: clear active states, grouped destinations, and visible hierarchy between current and secondary routes.",
    input:
      "Optimize for form completion: labels above controls, grouped fields, validation hints, and visible save/discard actions.",
    browse:
      "Optimize for browsing: filters, cards or rows with comparable metadata, and obvious item affordances.",
    monitor:
      "Optimize for monitoring: dense but legible metrics, status color used sparingly, and recent activity near the top.",
  };

  return directives[interaction ?? "read"];
}

function buildSplitFlowDirective(spec: WebAppSpec, screen: string): string {
  const match = screen.match(/^(.*)\s+-\s+(\d+)$/);
  if (!match) return "";

  const baseName = match[1].trim();
  const currentIndex = Number(match[2]);
  const siblings = spec.screens.filter((candidate) =>
    candidate.startsWith(`${baseName} - `),
  );

  if (siblings.length < 2) return "";

  return `
SPLIT MOBILE FLOW CONTEXT:
- This screen is step ${currentIndex} of ${siblings.length} in the "${baseName}" mobile flow.
- The complete flow is: ${siblings.join(" -> ")}.
- Render this as one connected product journey, not as a disconnected app concept.
- Include subtle step context or persistent destination cues when useful, but do not duplicate the same hero on every step.
`.trim();
}

export function buildGenerationDesignContract(
  spec: WebAppSpec,
  designContext?: DesignContext,
): string {
  if (spec.screens.length <= 1) return "";

  const allScreens = spec.screens.join(", ");

  return `
WEBSITE DESIGN CONSISTENCY CONTRACT (CRITICAL):
This generation contains ${spec.screens.length} screens: ${allScreens}.
All screens in this generation MUST share consistent design language:

SHARED DESIGN RULES:
- CSS Design Tokens: Use var(--surface), var(--primary), var(--accent), var(--text-primary), var(--text-secondary) on ALL screens. NEVER introduce new colors.
- Typography: Use identical font family ('Inter'), base size (16px), and heading hierarchy (H1/H2/H3 sizes) across all screens.
- Color Palette: Use ONLY primaryColor (${spec.primaryColor}) and accentColor (${spec.accentColor}) from this spec. Do NOT add new colors.
- Spacing: Follow 8pt system (gap-2/gap-4/gap-6/gap-8) consistently.
- Navigation: Use ${spec.navPattern} pattern consistently across all screens with identical styling.
- Layout Rhythm: Apply ${spec.dominantLayoutPattern || "standard grid"} pattern uniformly.

SCREEN RELATIONSHIPS:
- "${spec.screens[0]}" is the primary entry point
- All screens must have visual continuity - headers/footers should align structurally
- Do NOT repeat full hero sections on every page - use consistent sub-headers and section titles
- Secondary screens should complement, not duplicate, the landing page design

CONSISTENCY ENFORCEMENT:
- Use identical card component styling across ALL screens
- Buttons must have identical primary/secondary/ghost hierarchy across all screens
- Same spacing between sections on all screens
- No screen should look like it belongs to a different website
${
  designContext
    ? `
- Design system: ${designContext.style.name} style with ${designContext.palette.name} palette
- All screens follow this unified design direction`
    : ""
}
`.trim();
}

function buildDesignContextContract(designContext?: DesignContext): string {
  if (!designContext) return "";

  return `
AUTHORITATIVE DESIGN CONTEXT:
- Product type: ${designContext.productType}
- Direction: ${designContext.direction}
- Style: ${designContext.style.name} (${designContext.style.category})
- Typography intent: ${designContext.style.typography}
- Palette: ${designContext.palette.name}; psychology: ${designContext.palette.psychology}
- Layout hint: ${designContext.layout.name}; ${designContext.layout.cssStructure}
- UX priority: ${designContext.uxPriorities[0] || "Accessible contrast, clear hierarchy, and visible focus states."}
- Bias corrections to obey: ${designContext.biasCorrections.slice(0, 8).join(" ")}
`.trim();
}

export function buildScreenPrompt(
  spec: WebAppSpec,
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
  const components = node?.components ?? spec.components ?? [];
  const layoutArch = node?.layoutArchitecture;
  const componentIntents = node?.componentIntents ?? [];

  const isDark = spec.colorMode === "dark"; // Default to light surface colors if colorMode is not specified
  const isMobile = spec.platform === "mobile";

  const tokenSystem = `
DESIGN TOKENS (STRICTLY ENFORCED):
Define these as inline CSS variables on the root element and use them semantically.

## 1. COLOR TOKENS WITH USAGE RULES:

### Background Colors:
- --surface: ${isDark ? "#0f0f0f" : "#fbfbfa"} → Page background, main containers
- --surface-elevated: ${isDark ? "#1a1a1a" : "#f4f4f2"} → Cards, panels, modals, secondary containers
- --surface-overlay: ${isDark ? "#242424" : "#ececea"} → Dropdowns, popovers, overlays
- --border: ${isDark ? "rgba(255,255,255,0.10)" : "rgba(15,15,15,0.10)"} → All borders

### Text Colors:
- --text-primary: ${isDark ? "#f2f2ef" : "#10100e"} → Headings, body text, button labels (REQUIRED)
- --text-secondary: ${isDark ? "rgba(242,242,239,0.66)" : "rgba(16,16,14,0.66)"} → Descriptions, captions, labels
- --text-tertiary: ${isDark ? "rgba(242,242,239,0.42)" : "rgba(16,16,14,0.42)"} → Placeholders, disabled text

### PRIMARY & ACCENT (MUST USE FOR INTERACTIVE ELEMENTS):
- --primary: ${spec.primaryColor} → PRIMARY buttons, links, active states, focus rings, icons
- --primary-muted: ${spec.primaryColor}22 → Hover states, selected backgrounds
- --accent: ${spec.accentColor} → Badges, notifications, highlights, secondary CTAs, success states
- --accent-muted: ${spec.accentColor}22 → Accent backgrounds, subtle highlights

### Semantic Colors:
- --success: ${spec.accentColor} → Success messages, positive states
- --warning: ${spec.primaryColor}CC → Warning states
- --error: #ef4444 → Error states, destructive actions

## 2. COLOR USAGE EXAMPLES (COPY THESE PATTERNS):

### PRIMARY BUTTON (MUST USE - THIS IS YOUR MAIN CTA):
\`\`\`tsx
<button className="bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 active:scale-[0.98] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]">
  Primary Action
</button>
\`\`\`

### SECONDARY BUTTON:
\`\`\`tsx
<button className="bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--surface-overlay)] active:scale-[0.98]">
  Secondary Action
</button>
\`\`\`

### GHOST/LINK BUTTON:
\`\`\`tsx
<button className="text-[var(--primary)] hover:underline focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2">
  Tertiary Action
</button>
\`\`\`

### CARD/CONTAINER:
\`\`\`tsx
<div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg shadow-sm hover:shadow-md">
  Content
</div>
\`\`\`

### LINK:
\`\`\`tsx
<a className="text-[var(--primary)] hover:opacity-80 focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2">
  Link Text
</a>
\`\`\`

### BADGE/ACCENT:
\`\`\`tsx
<span className="bg-[var(--accent)] text-white px-2 py-1 rounded-full text-xs font-medium">
  Badge
</span>
\`\`\`

## 3. CONTRAST RULES (CRITICAL - NEVER VIOLATE):
- Primary button text MUST be opposite of primary color: if primary is dark → text-white, if primary is light → text-black
- NEVER use: bg-[var(--primary)] text-[var(--primary)] - THIS IS INVISIBLE!
- NEVER use: bg-[var(--surface)] text-[var(--surface)] - INVISIBLE!
- All interactive elements MUST have focus states: ring-2 ring-[var(--primary)]
- Text on surface-elevated MUST use text-primary or text-secondary, NEVER surface

## 4. SPACING SYSTEM (8pt grid):
- Component-level: gap-2 (8px), gap-3 (12px), gap-4 (16px)
- Section-level: gap-6 (24px), gap-8 (32px), gap-12 (48px)
- Page-level: gap-16 (64px), gap-20 (80px), gap-24 (96px)
- NEVER use arbitrary p-5, p-7, m-3, m-5

## 5. BORDER-RADIUS SCALE:
- Small (buttons, inputs): rounded-md (8px)
- Medium (cards, modals): rounded-lg (12px)
- Large (hero sections): rounded-xl (16px)
- Full (avatars, pills): rounded-full

## 6. ELEVATION/SHADOW TOKENS:
- Subtle (cards): shadow-sm
- Medium (dropdowns): shadow-md
- Elevated (modals): shadow-lg
- Overlaid (drawers): shadow-xl

## 7. TYPOGRAPHY SCALE (Inter):
- Display: text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]
- H1: text-4xl font-bold tracking-tight leading-tight
- H2: text-2xl font-semibold tracking-tight
- H3: text-lg font-semibold
- Body: text-base leading-relaxed
- UI: text-sm font-medium
- Caption: text-xs font-medium tracking-wide uppercase
- MAX THREE visible type levels per section

## 8. WIDTH STANDARDS:
- Landing/Dashboard: max-w-[1280px] centered, use full viewport
- Content/Utility: max-w-[1024px] centered
- Forms: max-w-[640px] centered
- NEVER trap content in narrow centered column on desktop

## KEY TAKEAWAY:
- Use bg-[var(--surface)] for page backgrounds
- Use bg-[var(--surface-elevated)] for cards, buttons, inputs
- Use bg-[var(--primary)] for PRIMARY buttons and links (with white/black text for contrast)
- Use bg-[var(--accent)] for badges, highlights
- ALWAYS ensure contrast between background and text
`.trim();

  const componentStates = `
## COMPONENT STATES (REQUIRED FOR ALL INTERACTIVE ELEMENTS)

### All Interactive Elements MUST Have:
1. **Default state**: Base appearance using tokens
2. **Hover state**: Slightly lighter/darker, cursor pointer
3. **Active state**: Scale down slightly (scale-[0.98]) or darker
4. **Focus state**: ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]
5. **Disabled state**: opacity-50 cursor-not-allowed

### Button States:
- Default: bg-[var(--primary)] text-white (for primary) OR bg-[var(--surface-elevated)] text-[var(--text-primary)] (for secondary)
- Hover: hover:bg-[var(--primary)]/90 OR hover:bg-[var(--surface-overlay)]
- Active: active:scale-[0.98] active:opacity-90
- Focus: focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface)]
- Disabled: disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none

### Link States:
- Default: text-[var(--primary)] underline-offset-2
- Hover: hover:opacity-80 OR hover:underline
- Focus: focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
- Never leave links without hover states

### Card/Container States:
- Default: bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg
- Hover: hover:shadow-md OR hover:border-[var(--primary)]/50
- Focus: focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:ring-offset-2

### Input States:
- Default: bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2
- Focus: focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
- Error: border-[var(--error)] focus:ring-[var(--error)]
- Disabled: bg-[var(--surface)] opacity-50
`.trim();

  const designDecisionRules = `
## DESIGN DECISION RULES (FOLLOW THIS DECISION TREE)

### 1. BUTTON HIERARCHY DECISION:
**Is this the MAIN action on the screen?**
- YES (primary CTA like "Sign Up", "Buy Now", "Submit"): 
  → Use: className="bg-[var(--primary)] text-white"
- Is it a secondary action (Cancel, Back, Skip)?
  → Use: className="bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border)]"
- Is it a tertiary/link action?
  → Use: className="text-[var(--primary)] hover:underline"

### 2. BACKGROUND DECISION:
**Is this clickable/interactive?**
- YES (button, link, card with action):
  → Use: bg-[var(--surface-elevated)] or bg-[var(--primary)] for primary
- NO (static content, info display):
  → Use: bg-[var(--surface)]

### 3. TEXT COLOR DECISION:
**What level of importance?**
- Heading / Primary content: text-[var(--text-primary)] (REQUIRED)
- Description / Label: text-[var(--text-secondary)]
- Placeholder / Disabled: text-[var(--text-tertiary)]
- NEVER use text-[var(--surface)] or text-[var(--primary)] for content text

### 4. CONTRAST CHECK:
- Primary button: text MUST be white or black (opposite of primaryColor)
- If primaryColor is dark (#000 to #666): text-white
- If primaryColor is light (#999 to #fff): text-black
- TEST: If you can't read the text on the background without strain, it's WRONG

### 5. FOCUS STATE MANDATORY:
- Every button, link, input MUST have focus:ring
- This is accessibility requirement: focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2

### 6. WHEN TO USE PRIMARY vs ACCENT:
- PRIMARY: Main CTAs, links, active navigation, primary content
- ACCENT: Badges, notifications, success indicators, secondary highlights
- NEVER use primary for everything - reserve it for most important elements
`.trim();

  const layoutDirective = layoutArch
    ? `
MANDATORY LAYOUT ARCHITECTURE:
- Outer container: ${layoutArch.outerContainer}
- Primary grid: ${layoutArch.primaryGrid}
- Section structure: ${((layoutArch.sectionBreaks as string[]) ?? []).join(" -> ") || "screen-specific sections"}
- Fixed UI elements: ${((layoutArch.fixedElements as string[]) ?? []).join(", ") || "none"}
- Content start offset: ${layoutArch.contentStartOffset ?? "0px"}
`
    : "";

  const designBrief = `
DESIGN BRIEF:
- Screen: ${screen}
- Visual personality: ${spec.visualPersonality || "minimal-utility"}
- Emotional tone: ${spec.keyEmotionalTone || "trustworthy"}
- Layout pattern: ${spec.dominantLayoutPattern || "dashboard-grid"}
- Typography authority: ${spec.typographyAuthority || "body-balanced"}
- Spacing philosophy: ${spec.spacingPhilosophy || "balanced"}
- Density: ${spec.contentDensityScore || 3}/5
- Platform: ${isMobile ? "mobile, 390px viewport, touch-first" : "web, desktop-first, 1280px and wider"}
- Navigation directive: ${buildNavDirective(spec.navPattern)}
- Interaction directive: ${buildInteractionDirective(spec.primaryInteraction)}
`.trim();

  const componentPlan =
    componentIntents.length > 0
      ? `
COMPONENT PLACEMENT PLAN:
${(
  componentIntents as Array<{
    component: string;
    role: string;
    spatialWeight: string;
    visualPriority: number;
    interactionType: string;
  }>
)
  .map((intent) => {
    const classes =
      SPATIAL_WEIGHT_CLASS_MAP[intent.spatialWeight] ?? "col-span-full";
    return `- Priority ${intent.visualPriority}: ${intent.component}; role=${intent.role}; spatialWeight=${intent.spatialWeight}; classes=${classes}; interaction=${intent.interactionType}`;
  })
  .join("\n")}
`
      : `COMPONENTS TO INCLUDE: ${components.join(", ") || "derive from user intent"}`;

  const antiPatterns = `
ANTI-PATTERNS TO AVOID:
- Equal-size KPI cards with identical visual weight. Vary emphasis and add trend context.
- Generic three-card feature rows. Use asymmetric rhythm or a table/list when the content is comparable.
- text-gray-500 for all secondary text. Use the token system.
- Every button styled as primary. Use primary, secondary, and ghost hierarchy.
- p-4 on every element. Follow the spacing contract.
- Single-column desktop forms with 5+ fields. Use lg:grid-cols-2.
- Dashboard content trapped in a narrow centered column. Use the available width.
`.trim();

  const generationContract = buildGenerationDesignContract(spec, designContext);

  return `
Generate a complete, production-quality React component for screen: "${screen}".

USER INTENT:
${userPrompt}

${designBrief}

${buildSplitFlowDirective(spec, screen)}

${generationContract}

${buildDesignContextContract(designContext)}

${tokenSystem}

${componentStates}

${designDecisionRules}

${layoutDirective}

${componentPlan}

${antiPatterns}

SYNTAX REQUIREMENTS:
- Component name: GeneratedScreen.
- Root element must include style={{ fontFamily: "'Inter', system-ui, sans-serif" }}.
- Include realistic mock data with at least 4 items for every list, grid, chart, or table.
- Close all JSX tags and balance all braces.
- Final line: export default GeneratedScreen;
- Output code only.
`.trim();
}

export function buildCritiquePrompt(
  screen: string,
  generatedCode: string,
  spec: WebAppSpec,
  userPrompt: string,
): string {
  return `
${STAGE4_CRITIQUE_SYSTEM}

## Screen Context
- Screen name: ${screen}
- User intent: ${userPrompt}
- Visual personality: ${spec.visualPersonality || "minimal-utility"}
- Emotional tone: ${spec.keyEmotionalTone || "trustworthy"}
- Layout pattern: ${spec.dominantLayoutPattern || "dashboard-grid"}

## Generated Code to Review
\`\`\`tsx
${generatedCode}
\`\`\`

## Your Task
1. Read the generated code carefully
2. Evaluate against each criteria (1-10)
3. Provide specific, actionable feedback if issues found
4. Output ONLY valid JSON with zero markdown
`.trim();
}
