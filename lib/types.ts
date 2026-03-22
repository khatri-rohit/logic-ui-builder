export interface WebAppSpec {
  screens: string[];
  navPattern: "top-nav" | "sidebar" | "hybrid" | "none";
  platform: "web";
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
