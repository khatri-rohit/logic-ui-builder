import { ComponentTreeNode, WebAppSpec } from "./types";

const CREATIVITY_DIRECTIVE = `
Design quality bar (critical):
- Avoid generic or templated layouts.
- Build one clear visual concept per screen with intentional hierarchy.
- Use distinctive typography pairings (no default/system-only look).
- Use a cohesive color system with one dominant direction and sharp accents.
- Add meaningful motion hints (entry/stagger/interaction), not random effects.
- Build atmosphere with gradients, overlays, patterns, or depth layers.
- Keep accessibility: readable text, semantic landmarks, visible states.
- Keep responsiveness: mobile-first and desktop-ready structure.
`.trim();

const COMPILE_GUARDRAILS = `
Compilation guardrails (must pass):
- Output valid TSX only. No markdown, no prose.
- Write one complete component function with balanced (), {}, and [].
- Close every JSX tag and every string/template literal.
- Avoid unsupported syntax and avoid trailing partial lines.
- Use inline mock data inside the file if needed.
- Do not import or export anything.
- Before finishing, self-check syntax and then append: // === END ===
`.trim();

export const STAGE1_SYSTEM = `
You are an Architecture Snapshot extractor for web applications.
Given a user prompt, output ONLY valid JSON matching this schema exactly.
No explanation. No markdown. Pure JSON only.

${CREATIVITY_DIRECTIVE}

Output this exact structure:
{
  "screens": ["ScreenName"],
  "navPattern": "top-nav|sidebar|hybrid|none",
  "platform": "web",
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

Each item: { "screen": "name", "components": ["list"], "canvasX": number, "canvasY": number }
Space screens 240px apart horizontally starting at x=60, y=80.
`.trim();

export const STAGE3_SYSTEM = `
You are a React web developer. Generate a single TSX screen component.
Rules (follow exactly):
- Web only. Use HTML elements (div, header, nav, main, section, button, input, img, table, etc.)
- Do NOT use React Native or Expo APIs/components (View, Text, ScrollView, TouchableOpacity, FlatList, SafeAreaView)
- Do NOT import from any package
- Do NOT export anything
- TypeScript + TSX only
- Use inline styles or simple className strings that do not rely on external CSS frameworks
- Keep output self-contained in one file and include small inline mock data where useful
- Return code only. No markdown fences. No explanations.
- End your response with exactly: // === END ===

${CREATIVITY_DIRECTIVE}
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
    platform: { type: "string", enum: ["web"] },
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
): string {
  const node = tree.find((n) => n.screen === screen);
  const components = node?.components ?? [];

  return `
Generate a React web screen component for: ${screen}

App context:
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
- No imports and no exports
- Do not use React Native components/APIs
- Use only web/DOM elements and browser-safe React patterns
- Return code only (no markdown)
- End with exactly: // === END ===

Creative direction from design skill system:
- Match the screen intent with a deliberate style direction.
- Use typographic contrast and avoid default-looking combinations.
- Build a color hierarchy with purpose (surface, primary, accent, muted).
- Include hover/focus/active visual states on interactive UI.
- Add subtle staged reveal patterns for key content blocks.
- Avoid repetitive card-grid boilerplate unless the prompt explicitly asks for it.

Syntax safety checklist:
- Ensure all JSX tags are closed.
- Ensure all delimiters are balanced: (), {}, [].
- Ensure all quotes and template literals are closed.
- Ensure the final line is exactly: // === END ===
`.trim();
}
