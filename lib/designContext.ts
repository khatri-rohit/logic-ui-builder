import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DesignContext,
  DesignPalette,
  DesignStyle,
  GenerationPlatform,
  LayoutHint,
  TypographyHint,
} from "./types";

type CsvRow = Record<string, string>;

type SkillsIndex = {
  palettes: DesignPalette[];
  styles: DesignStyle[];
  layouts: LayoutHint[];
  typography: TypographyHint[];
  uxPriorities: string[];
};

let cachedSkillsIndex: SkillsIndex | null = null;

const FALLBACK_PALETTE: DesignPalette = {
  name: "Classic Blue Trust",
  primaryHex: "#003366",
  secondaryHex: "#0055A4",
  accentHex: "#FFD700",
  backgroundHex: "#FFFFFF",
  textHex: "#1A1A1A",
  psychology: "Trust reliability professionalism",
};

const FALLBACK_STYLE: DesignStyle = {
  name: "Minimalist",
  category: "General",
  keywords: "clean, simple, essential, whitespace, geometric, modern",
  typography: "Sans-serif thin weight",
  effects: "None, sharp edges, high contrast",
  bestFor: "Tech startups SaaS apps professional services",
  avoidFor: "Playful brands children entertainment",
  complexity: "Low",
};

const FALLBACK_LAYOUT: LayoutHint = {
  name: "Feature Grid",
  useCase: "Showcase multiple features",
  cssStructure: "display:grid; grid-template-columns:repeat(3,1fr); gap:24px",
  visualTreatment: "icon-top",
};

const FALLBACK_TYPOGRAPHY: TypographyHint = {
  contentType: "feature-grid",
  primarySize: "28px",
  secondarySize: "16px",
  accentSize: "12px",
  weightContrast: "600-400",
  lineHeight: "1.4",
};

const FALLBACK_UX_PRIORITIES = [
  "Contrast 4.5:1 minimum and visible keyboard focus states.",
  "Touch targets at least 44x44 with clear active/disabled feedback.",
  "Use lazy loading and reserve media dimensions to reduce layout shift.",
  "Avoid horizontal overflow; mobile-first spacing and readable line lengths.",
  "Use one primary CTA per screen with clear semantic hierarchy.",
];

const BIAS_CORRECTIONS = [
  "NO EMOJIS: Replace symbols with high-quality icons (Radix, Phosphor, Lucide) or clean SVG primitives.",
  "NO AI PURPLE: Avoid the 'AI Purple/Blue' aesthetic. Use neutral bases (Zinc/Slate) with singular high-contrast accents.",
  "NO SYSTEM DEFAULT: Use the runtime font contract consistently; avoid browser-default serif fallbacks.",
  "NO GENERIC NAMES: Avoid 'John Doe' or 'Acme Corp'. Use realistic, contextual brand and user names.",
  "NO 3-COLUMN CARDS: Avoid the generic 3-equal-card feature row. Use asymmetric grids or zig-zags.",
  "NO PURE BLACK: Never use #000000. Use Off-Black, Zinc-950, or Charcoal.",
  "CRITICAL: NO HARDCODED COLORS - Use design tokens only (var(--surface), var(--primary), var(--accent)). Never use bg-blue-500, #3b82f6, rgb(), or hex codes directly.",
  "CRITICAL: NO ARBITRARY SPACING - Use 8pt grid only (gap-2, gap-4, gap-6, gap-8). Never use p-5, p-7, m-3, m-5.",
  "NO EQUAL-WEIGHT KPI CARDS: Vary KPI card sizes to create visual hierarchy. Don't make all cards the same size.",
  "NO NARROW CENTERED COLUMNS: On desktop, use full viewport width. Never trap content in a narrow centered container.",
  "NO TEXT-GRAY-500: Use text-[var(--text-secondary)] or text-[var(--text-tertiary)] for secondary text.",
  "NO EMERGENCY GRADIENTS: Avoid decorative gradients unless explicitly requested. Keep surfaces flat.",
  "NO GENERIC EMPTY STATES: Empty states need specific copy, a compact visual element, and one clear action.",
];

const SHORT_DESIGN_TOKENS = new Set(["ui", "ux", "ai", "3d", "ar", "vr"]);
const STOPWORDS = new Set([
  "app",
  "apps",
  "web",
  "site",
  "page",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "make",
  "build",
  "create",
  "need",
  "want",
  "user",
  "users",
]);

function normalizeDesignText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\be[\s-]?commerce\b/g, "ecommerce")
    .replace(/\bsaas\b/g, "software service")
    .replace(/\bfin[\s-]?tech\b/g, "fintech finance")
    .replace(/\bhealth[\s-]?care\b/g, "healthcare")
    .replace(/\breal[\s-]?time\b/g, "realtime live")
    .replace(/\bdata[\s-]?heavy\b/g, "data dense")
    .replace(/[^a-z0-9\s]/g, " ");
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function tokenize(text: string): string[] {
  return normalizeDesignText(text)
    .split(/\s+/)
    .filter((token) => {
      if (!token) return false;
      if (STOPWORDS.has(token)) return false;
      return token.length > 2 || SHORT_DESIGN_TOKENS.has(token);
    });
}

function computeScore(inputTokens: string[], haystack: string): number {
  const normalized = normalizeDesignText(haystack);
  const haystackTokens = new Set(tokenize(haystack));
  let score = 0;

  for (const token of inputTokens) {
    if (haystackTokens.has(token)) {
      score += 2;
    } else if (token.length >= 5 && normalized.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function computeWeightedScore(
  inputTokens: string[],
  fields: Array<{ text: string; weight: number }>,
): number {
  return fields.reduce(
    (total, field) => total + computeScore(inputTokens, field.text) * field.weight,
    0,
  );
}

function pickBest<T>(items: T[], scoreFn: (item: T) => number, fallback: T): T {
  if (items.length === 0) return fallback;

  let best = fallback;
  let bestScore = -1;

  for (const item of items) {
    const score = scoreFn(item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return best;
}

function inferProductType(prompt: string): string {
  const normalized = prompt.toLowerCase();

  if (/(dashboard|analytics|kpi|metrics)/.test(normalized)) return "dashboard";
  if (/(landing|hero|marketing|conversion)/.test(normalized)) return "landing";
  if (/(ecommerce|checkout|cart|product)/.test(normalized)) return "ecommerce";
  if (/(portfolio|case study|agency|creative)/.test(normalized))
    return "portfolio";
  if (/(admin|settings|management|panel)/.test(normalized)) return "admin";

  return "web-app";
}

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

async function loadSkillsIndex(): Promise<SkillsIndex> {
  if (cachedSkillsIndex) return cachedSkillsIndex;

  const root = process.cwd();
  const stylesPath = path.join(
    root,
    ".github",
    "skills",
    "design",
    "data",
    "logo",
    "styles.csv",
  );
  const colorsPath = path.join(
    root,
    ".github",
    "skills",
    "design",
    "data",
    "logo",
    "colors.csv",
  );
  const layoutsPath = path.join(
    root,
    ".github",
    "skills",
    "design-system",
    "data",
    "slide-layouts.csv",
  );
  const typographyPath = path.join(
    root,
    ".github",
    "skills",
    "design-system",
    "data",
    "slide-typography.csv",
  );
  const uxSkillPath = path.join(
    root,
    ".github",
    "skills",
    "ui-ux-pro-max",
    "SKILL.md",
  );

  const [
    stylesResult,
    colorsResult,
    layoutsResult,
    typographyResult,
    uxSkillResult,
  ] = await Promise.allSettled([
    fs.readFile(stylesPath, "utf8"),
    fs.readFile(colorsPath, "utf8"),
    fs.readFile(layoutsPath, "utf8"),
    fs.readFile(typographyPath, "utf8"),
    fs.readFile(uxSkillPath, "utf8"),
  ]);

  const stylesCsv =
    stylesResult.status === "fulfilled" ? stylesResult.value : "";
  const colorsCsv =
    colorsResult.status === "fulfilled" ? colorsResult.value : "";
  const layoutsCsv =
    layoutsResult.status === "fulfilled" ? layoutsResult.value : "";
  const typographyCsv =
    typographyResult.status === "fulfilled" ? typographyResult.value : "";
  const uxSkill =
    uxSkillResult.status === "fulfilled" ? uxSkillResult.value : "";

  const styleRows = parseCsv(stylesCsv);
  const colorRows = parseCsv(colorsCsv);
  const layoutRows = parseCsv(layoutsCsv);
  const typographyRows = parseCsv(typographyCsv);

  const palettes: DesignPalette[] =
    colorRows.length > 0
      ? colorRows.map((row) => ({
          name: row["Palette Name"] || "",
          primaryHex: row["Primary Hex"] || "",
          secondaryHex: row["Secondary Hex"] || "",
          accentHex: row["Accent Hex"] || "",
          backgroundHex: row["Background Hex"] || "",
          textHex: row["Text Hex"] || "",
          psychology: row["Psychology"] || "",
        }))
      : [{ ...FALLBACK_PALETTE }];

  const styles: DesignStyle[] =
    styleRows.length > 0
      ? styleRows.map((row) => ({
          name: row["Style Name"] || "",
          category: row["Category"] || "",
          keywords: row["Keywords"] || "",
          typography: row["Typography"] || "",
          effects: row["Effects"] || "",
          bestFor: row["Best For"] || "",
          avoidFor: row["Avoid For"] || "",
          complexity: row["Complexity"] || "",
        }))
      : [{ ...FALLBACK_STYLE }];

  const layouts: LayoutHint[] =
    layoutRows.length > 0
      ? layoutRows.map((row) => ({
          name: row["layout_name"] || "",
          useCase: row["use_case"] || "",
          cssStructure: row["css_structure"] || "",
          visualTreatment: row["visual_treatment"] || "",
        }))
      : [{ ...FALLBACK_LAYOUT }];

  const typography: TypographyHint[] =
    typographyRows.length > 0
      ? typographyRows.map((row) => ({
          contentType: row["content_type"] || "",
          primarySize: row["primary_size"] || "",
          secondarySize: row["secondary_size"] || "",
          accentSize: row["accent_size"] || "",
          weightContrast: row["weight_contrast"] || "",
          lineHeight: row["line_height"] || "",
        }))
      : [{ ...FALLBACK_TYPOGRAPHY }];

  const uxMatches = [...uxSkill.matchAll(/- `([^`]+)` - ([^\n]+)/g)]
    .slice(0, 10)
    .map((match) => `${match[1]}: ${match[2].trim()}`);

  cachedSkillsIndex = {
    palettes,
    styles,
    layouts,
    typography,
    uxPriorities:
      uxMatches.length > 0 ? uxMatches : [...FALLBACK_UX_PRIORITIES],
  };

  return cachedSkillsIndex;
}

export function toDesignContextText(context: DesignContext): string {
  return [
    "Skill-informed design context:",
    `- Product type: ${context.productType}`,
    `- Design direction: ${context.direction}`,
    `- Style: ${context.style.name} (${context.style.category})`,
    `- Style keywords: ${context.style.keywords}`,
    `- Typography pairing intent: ${context.style.typography}`,
    `- Visual effects: ${context.style.effects}`,
    `- Palette: ${context.palette.name}`,
    `- Color psychology: ${context.palette.psychology}`,
    `- Color tokens: primary ${context.palette.primaryHex}, secondary ${context.palette.secondaryHex}, accent ${context.palette.accentHex}, background ${context.palette.backgroundHex}, text ${context.palette.textHex}`,
    `- Preferred layout: ${context.layout.name}`,
    `- Layout structure hint: ${context.layout.cssStructure}`,
    `- Layout treatment: ${context.layout.visualTreatment}`,
    `- Typography scale: ${context.typography.contentType} (primary ${context.typography.primarySize}, secondary ${context.typography.secondarySize}, accent ${context.typography.accentSize}, line-height ${context.typography.lineHeight})`,
    `- Design Dials: Variance ${context.designDials.variance}, Motion ${context.designDials.motion}, Density ${context.designDials.density}`,
    "- UX priorities:",
    ...context.uxPriorities.map((priority) => `  - ${priority}`),
    "- Bias Corrections (Strictly Enforced):",
    ...context.biasCorrections.map((correction) => `  - ${correction}`),
  ].join("\n");
}

export async function buildDesignContext(input: {
  prompt: string;
  platform: GenerationPlatform;
}): Promise<DesignContext> {
  const index = await loadSkillsIndex();
  const inputTokens = tokenize(input.prompt);
  const productType = inferProductType(input.prompt);
  const designDials = inferDesignDials(input.prompt);

  const style = pickBest(
    index.styles,
    (candidate) =>
      computeWeightedScore(inputTokens, [
        { text: candidate.keywords, weight: 4 },
        { text: candidate.bestFor, weight: 3 },
        { text: candidate.category, weight: 2 },
        { text: candidate.name, weight: 1 },
        { text: productType, weight: 2 },
      ]),
    FALLBACK_STYLE,
  );

  const palette = pickBest(
    index.palettes,
    (candidate) =>
      computeWeightedScore(inputTokens, [
        { text: candidate.psychology, weight: 4 },
        { text: productType, weight: 3 },
        { text: candidate.name, weight: 1 },
      ]),
    FALLBACK_PALETTE,
  );

  const layout = pickBest(
    index.layouts,
    (candidate) =>
      computeWeightedScore(inputTokens, [
        { text: candidate.useCase, weight: 4 },
        { text: candidate.cssStructure, weight: 3 },
        { text: productType, weight: 2 },
        { text: candidate.name, weight: 1 },
      ]),
    FALLBACK_LAYOUT,
  );

  const typography = pickBest(
    index.typography,
    (candidate) =>
      computeWeightedScore(inputTokens, [
        { text: candidate.contentType, weight: 4 },
        { text: layout.name, weight: 2 },
        { text: productType, weight: 2 },
      ]),
    FALLBACK_TYPOGRAPHY,
  );

  const direction =
    input.platform === "mobile"
      ? `${style.name} mobile-first with compact rhythm`
      : `${style.name} desktop-first with structured hierarchy`;

  return {
    productType,
    direction,
    palette,
    style,
    layout,
    typography,
    uxPriorities: index.uxPriorities.slice(0, 5),
    biasCorrections: BIAS_CORRECTIONS,
    designDials,
  };
}
