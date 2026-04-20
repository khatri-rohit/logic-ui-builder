export type GenerationPlatform = "web" | "mobile";

export interface DesignPalette {
  name: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  backgroundHex: string;
  textHex: string;
  psychology: string;
}

export interface DesignStyle {
  name: string;
  category: string;
  keywords: string;
  typography: string;
  effects: string;
  bestFor: string;
  avoidFor: string;
  complexity: string;
}

export interface LayoutHint {
  name: string;
  useCase: string;
  cssStructure: string;
  visualTreatment: string;
}

export interface TypographyHint {
  contentType: string;
  primarySize: string;
  secondarySize: string;
  accentSize: string;
  weightContrast: string;
  lineHeight: string;
}

export interface DesignContext {
  productType: string;
  direction: string;
  palette: DesignPalette;
  style: DesignStyle;
  layout: LayoutHint;
  typography: TypographyHint;
  uxPriorities: string[];
}

export interface WebAppSpec {
  screens: string[];
  navPattern: "top-nav" | "sidebar" | "hybrid" | "none";
  platform: GenerationPlatform;
  colorMode: "dark" | "light";
  primaryColor: string;
  accentColor: string;
  stylingLib: "css" | "tailwind";
  layoutDensity: "comfortable" | "compact";
  components: string[];

  // Design DNA — new fields from upgraded Stage 1
  visualPersonality?:
    | "corporate-precision"
    | "editorial-bold"
    | "minimal-utility"
    | "expressive-brand"
    | "data-dense"
    | "conversational-warm";
  dominantLayoutPattern?:
    | "full-page-sections"
    | "dashboard-grid"
    | "sidebar-content"
    | "centered-focused"
    | "split-screen"
    | "data-table-primary";
  typographyAuthority?:
    | "display-driven"
    | "body-balanced"
    | "data-first"
    | "label-dominant";
  spacingPhilosophy?: "airy" | "balanced" | "dense";
  primaryInteraction?: "read" | "navigate" | "input" | "browse" | "monitor";
  keyEmotionalTone?: string;
  contentDensityScore?: number;
}

export interface ComponentTreeNode {
  screen: string;
  components: string[];
  canvasX: number;
  canvasY: number;

  // Stage 2 layout architecture — consumed by buildScreenPrompt
  layoutArchitecture?: {
    outerContainer: string;
    primaryGrid: string;
    sectionBreaks: string[];
    fixedElements: string[];
    contentStartOffset: string;
  };
  componentIntents?: Array<{
    component: string;
    role: string;
    spatialWeight: string;
    visualPriority: number;
    interactionType: string;
  }>;
}
// Backward-compatible alias while migration to WebAppSpec completes.
export type MobileSpec = WebAppSpec;
