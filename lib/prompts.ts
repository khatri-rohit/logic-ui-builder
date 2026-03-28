import { ComponentTreeNode, WebAppSpec } from "./types";

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
- Prefer shadcn-style component composition patterns when stylingLib is "shadcn".
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
You are an Architecture Snapshot extractor for web applications.
Given a user prompt, output ONLY valid JSON matching this schema exactly.
No explanation. No markdown. Pure JSON only.

${CREATIVITY_DIRECTIVE}
${INTENT_LOCK_DIRECTIVE}
${SKILL_DIRECTIVE}
${MOBILE_SPLIT_DIRECTIVE}
${STATIC_LAYOUT_DIRECTIVE}

Output this exact structure:
{
  "screens": ["ScreenName"],
  "navPattern": "top-nav|sidebar|hybrid|none",
  "platform": "web|mobile",
  "colorMode": "dark|light",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "stylingLib": "css|tailwind|shadcn",
  "layoutDensity": "comfortable|compact",
  "components": ["ComponentName"]
}
`.trim();

export const STAGE2_SYSTEM = `
You are a web UI component planner.
Given a WebAppSpec JSON,
output ONLY a JSON array. No explanation. No markdown.

${CREATIVITY_DIRECTIVE}
${INTENT_LOCK_DIRECTIVE}
${MOBILE_SPLIT_DIRECTIVE}
${STATIC_LAYOUT_DIRECTIVE}

Each item: { "screen": "name", "components": ["list"], "canvasX": number, "canvasY": number }
Space screens 240px apart horizontally starting at x=60, y=80.
`.trim();

export const STAGE3_SYSTEM = `
You are a frontend developer. Generate a React TypeScript component.
Rules:
- Standard React + TypeScript only
- You MAY import from: recharts, lucide-react, date-fns, clsx
- Use Tailwind CSS classes for styling (CDN available)
- Apply explicit Tailwind className values on major layout, spacing, and typography elements; avoid browser-default presentation.
- No React Native imports
- No local file imports like ./ui/card or ../components/button
- Do not use shadcn-specific patterns or components even if stylingLib is "shadcn" — just apply Tailwind classes with the same design intent
- Generate static layout only: do not add animations, transitions, keyframes, or motion-library usage

${CREATIVITY_DIRECTIVE}
${INTENT_LOCK_DIRECTIVE}
${SKILL_DIRECTIVE}
${STATIC_LAYOUT_DIRECTIVE}
${COMPILE_GUARDRAILS}
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
    stylingLib: { type: "string", enum: ["css", "tailwind", "shadcn"] },
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
  spec: WebAppSpec,
  tree: ComponentTreeNode[],
  screen: string,
  userPrompt: string,
): string {
  const node = tree.find((n) => n.screen === screen);
  const components = node?.components ?? [];

  return `
Generate a React web screen component for: ${screen}

App context:
- Original user prompt: ${userPrompt}
- Platform: ${spec.platform}
- Color mode: ${spec.colorMode}
- Primary color: ${spec.primaryColor}
- Accent color: ${spec.accentColor}
- Styling: ${spec.stylingLib}
- Navigation pattern: ${spec.navPattern}
- Total screens in app: ${spec.screens.join(", ")}

This screen must include these components:
${components.map((c) => `- ${c}`).join("\n")}

Requirements:
- Component name must be exactly: GeneratedScreen
- imports allowed; but export the component at the end with: export default GeneratedScreen;
- Do not use React Native components/APIs
- Use only web/DOM elements and browser-safe React patterns
- Generate static layout only: do not add animations, transitions, keyframes, or motion-library usage
- If platform is mobile, use compact spacing, touch-friendly hit areas, and phone-like content proportions
- If platform is mobile, keep this screen scoped as one mobile step; do not include an entire long-form app flow in one screen
- If platform is web, design for desktop width and natural full-page vertical flow
- If platform is web, the outermost layout wrapper must be desktop-width (w-full, min-h-screen) and must not use narrow width caps such as max-w-sm, max-w-md, or max-w-lg
- If platform is web, prefer multi-column composition at desktop breakpoints (lg:) instead of a single narrow centered column
- Return code only (no markdown)

Creative direction from design skill system:
- Match the screen intent with a deliberate style direction.
- Use typographic contrast and avoid default-looking combinations.
- Build a color hierarchy with purpose (surface, primary, accent, muted).
- Keep interactions visually clear without transition or animation effects.
- Avoid repetitive card-grid boilerplate unless the prompt explicitly asks for it.

Intent lock:
- Do not add any product feature or section that is not implied by the prompt.
- Keep labels, modules, and interactions grounded in the requested scenario only.

Syntax safety checklist:
- Ensure all JSX tags are closed.
- Ensure all delimiters are balanced: (), {}, [].
- Ensure all quotes and template literals are closed.
`.trim();
}
