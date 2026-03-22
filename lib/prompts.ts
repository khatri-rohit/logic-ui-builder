import { ComponentTreeNode, WebAppSpec } from "./types";

export const STAGE1_SYSTEM = `
You are an Architecture Snapshot extractor for web applications.
Given a user prompt, output ONLY valid JSON matching this schema exactly.
No explanation. No markdown. Pure JSON only.

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
- Component name must be exactly: ${screen}
- No imports and no exports
- Do not use React Native components/APIs
- Use only web/DOM elements and browser-safe React patterns
- Return code only (no markdown)
- End with exactly: // === END ===
`.trim();
}
