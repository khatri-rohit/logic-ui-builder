import { ComponentTreeNode, MobileSpec } from "./types"

export const STAGE1_SYSTEM = `
You are a JSON extractor. Given a user prompt for a mobile app, 
output ONLY valid JSON matching this schema exactly.
No explanation. No markdown. Pure JSON only.

Output this exact structure:
{
  "screens": ["ScreenName"],
  "navPattern": "tabs|stack|drawer",
  "platform": "ios|android|universal",
  "colorMode": "dark|light",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "stylingLib": "nativewind|tamagui",
  "gestures": ["swipe-back"],
  "components": ["ComponentName"]
}
`.trim()

export const STAGE2_SYSTEM = `
You are a component planner. Given a MobileSpec JSON, 
output ONLY a JSON array. No explanation. No markdown.

Each item: { "screen": "name", "components": ["list"], "canvasX": number, "canvasY": number }
Space screens 240px apart horizontally starting at x=60, y=80.
`.trim()

export const STAGE3_SYSTEM = `
You are a React Native developer. Generate a single screen component.
Rules (follow exactly):
- Use React Native core components: View, Text, ScrollView, TouchableOpacity, Image, FlatList
- Use NativeWind className props for styling (Tailwind syntax)
- TypeScript with full Props interface
- Functional component, default export
- Do NOT import from expo — only react-native
- Do NOT add navigation logic
- One file only, no external dependencies besides react-native
- End your response with exactly: // === END ===
`.trim()

// JSON Schema for MobileSpec — forces Ollama to output valid structure
export const MOBILE_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    screens: { type: 'array', items: { type: 'string' } },
    navPattern: { type: 'string', enum: ['tabs', 'stack', 'drawer'] },
    platform: { type: 'string', enum: ['ios', 'android', 'universal'] },
    colorMode: { type: 'string', enum: ['dark', 'light'] },
    primaryColor: { type: 'string' },
    accentColor: { type: 'string' },
    stylingLib: { type: 'string', enum: ['nativewind', 'tamagui'] },
  },
  required: ['screens', 'navPattern', 'platform', 'colorMode']
}

// lib/prompts.ts — add this function

export function buildScreenPrompt(
  spec: MobileSpec,
  tree: ComponentTreeNode[],
  screen: string
): string {
  const node = tree.find(n => n.screen === screen)
  const components = node?.components ?? []

  return `
Generate a React Native screen component for: ${screen}

App context:
- Platform: ${spec.platform}
- Color mode: ${spec.colorMode}
- Primary color: ${spec.primaryColor}
- Accent color: ${spec.accentColor}
- Styling: ${spec.stylingLib}
- Navigation pattern: ${spec.navPattern}
- Total screens in app: ${spec.screens.join(', ')}

This screen must include these components:
${components.map(c => `- ${c}`).join('\n')}

Requirements:
- Component name must be exactly: ${screen}
- Default export
- NativeWind className props for all styling
- Full TypeScript props interface
- End with exactly: // === END ===
`.trim()
}