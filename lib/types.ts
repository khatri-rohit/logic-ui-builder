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
  stylingLib: "css" | "tailwind" | "shadcn";
  layoutDensity: "comfortable" | "compact";
  components: string[];
}

// Backward-compatible alias while migration to WebAppSpec completes.
export type MobileSpec = WebAppSpec;

export interface ComponentTreeNode {
  screen: string;
  components: string[];
  canvasX: number;
  canvasY: number;
}
