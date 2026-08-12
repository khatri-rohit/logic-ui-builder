import { DesignContext, WebAppSpec } from "@/lib/types";

export interface DesignContract {
  primaryColor: string;
  accentColor: string;
  colorMode: WebAppSpec["colorMode"];
  navPattern: WebAppSpec["navPattern"];
  layoutDensity: WebAppSpec["layoutDensity"];
  platform: WebAppSpec["platform"];
  visualPersonality: string;
  dominantLayoutPattern: string;
  typographyAuthority: string;
  spacingPhilosophy: string;
  keyEmotionalTone: string;
  contentDensityScore: number;
  styleName: string;
  styleCategory: string;
  paletteName: string;
  radiusScale: string;
  shadowScale: string;
  spacingScale: string;
}

const WEAK_ANCHOR_RE =
  /\b(login|log-in|signin|sign-in|signup|sign-up|register|auth|forgot|reset|otp|verify|splash|onboarding|welcome|404|empty|error)\b/i;

const STRONG_ANCHOR_RE =
  /\b(dashboard|home|overview|projects|main|app|feed|inbox|workspace|analytics|settings)\b/i;

export function isWeakDesignAnchor(screenName: string): boolean {
  return WEAK_ANCHOR_RE.test(screenName);
}

/** Prefer a shell/app screen as the visual reference — not login/auth. */
export function pickDesignAnchorIndex(screenNames: string[]): number {
  if (screenNames.length === 0) return 0;

  const strong = screenNames.findIndex(
    (name) => !isWeakDesignAnchor(name) && STRONG_ANCHOR_RE.test(name),
  );
  if (strong >= 0) return strong;

  const nonWeak = screenNames.findIndex((name) => !isWeakDesignAnchor(name));
  if (nonWeak >= 0) return nonWeak;

  return 0;
}

function densityDefaults(
  density: WebAppSpec["layoutDensity"],
  spacingPhilosophy?: string,
): {
  radiusScale: string;
  shadowScale: string;
  spacingScale: string;
} {
  const philosophy = spacingPhilosophy || "balanced";
  if (density === "compact" || philosophy === "dense") {
    return {
      radiusScale: "rounded-md dominant; rounded-lg sparingly",
      shadowScale: "shadow-sm for cards; avoid heavy elevation",
      spacingScale: "gap-2 / gap-3 / gap-4; section padding p-4 / p-6",
    };
  }
  if (philosophy === "airy") {
    return {
      radiusScale: "rounded-xl dominant; rounded-2xl for hero surfaces",
      shadowScale: "shadow-sm / soft elevation; keep surfaces calm",
      spacingScale: "gap-6 / gap-8 / gap-10; section padding p-8 / p-10",
    };
  }
  return {
    radiusScale: "rounded-lg dominant; rounded-md for controls",
    shadowScale: "shadow-sm / shadow-md for cards",
    spacingScale: "gap-4 / gap-6 / gap-8; section padding p-6 / p-8",
  };
}

export function buildDesignContract(
  spec: WebAppSpec,
  designContext: DesignContext,
): DesignContract {
  const scales = densityDefaults(spec.layoutDensity, spec.spacingPhilosophy);

  return {
    primaryColor: spec.primaryColor,
    accentColor: spec.accentColor,
    colorMode: spec.colorMode,
    navPattern: spec.navPattern,
    layoutDensity: spec.layoutDensity,
    platform: spec.platform,
    visualPersonality: spec.visualPersonality || "minimal-utility",
    dominantLayoutPattern: spec.dominantLayoutPattern || "dashboard-grid",
    typographyAuthority: spec.typographyAuthority || "body-balanced",
    spacingPhilosophy: spec.spacingPhilosophy || "balanced",
    keyEmotionalTone: spec.keyEmotionalTone || "trustworthy",
    contentDensityScore: spec.contentDensityScore ?? 3,
    styleName: designContext.style.name,
    styleCategory: designContext.style.category,
    paletteName: designContext.palette.name,
    ...scales,
  };
}

function topClasses(code: string, pattern: RegExp, limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const match of code.matchAll(pattern)) {
    const token = match[0];
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function extractVisualFingerprint(code: string): string {
  if (!code.trim()) return "";

  const rounded = topClasses(
    code,
    /\brounded-(?:none|sm|md|lg|xl|2xl|3xl|full)\b/g,
  );
  const shadows = topClasses(
    code,
    /\bshadow-(?:none|sm|md|lg|xl|2xl|inner)\b/g,
  );
  const gaps = topClasses(code, /\bgap-(?:[0-9]|1[0-2]|x-[0-9]|y-[0-9])\b/g);
  const padding = topClasses(
    code,
    /\b(?:p|px|py|pt|pb|pl|pr)-(?:[0-9]|1[0-2]|14|16|20|24)\b/g,
  );
  const typeScale = topClasses(
    code,
    /\b(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)|font-(?:normal|medium|semibold|bold))\b/g,
  );
  const tokens = topClasses(
    code,
    /var\(--(?:primary|accent|surface|surface-elevated|text-primary|text-secondary|border)\)/g,
    8,
  );

  const structuralHints: string[] = [];
  if (/\bw-64\b|\bw-56\b|\bsidebar\b/i.test(code)) {
    structuralHints.push("left-rail / sidebar width cues present");
  }
  if (
    /\bh-14\b|\bh-16\b|\btop-0\b.*\bsticky\b|\bsticky\b.*\btop-0\b/i.test(code)
  ) {
    structuralHints.push("sticky / top chrome cues present");
  }
  if (/\bflex\b/.test(code) && /\bmin-h-0\b|\bflex-1\b/.test(code)) {
    structuralHints.push("flex shell with fluid main region");
  }

  return [
    "Visual cues from the reference screen:",
    rounded.length ? `- Radius: ${rounded.join(", ")}` : null,
    shadows.length ? `- Shadows: ${shadows.join(", ")}` : null,
    gaps.length ? `- Gaps: ${gaps.join(", ")}` : null,
    padding.length ? `- Padding: ${padding.join(", ")}` : null,
    typeScale.length ? `- Typography classes: ${typeScale.join(", ")}` : null,
    tokens.length ? `- Tokens used: ${tokens.join(", ")}` : null,
    structuralHints.length
      ? `- Structure: ${structuralHints.join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDesignContractForPrompt(
  contract: DesignContract,
  fingerprint?: string,
): string {
  const lines = [
    "SHARED DESIGN DIRECTION (this generation):",
    `- Colors: primary ${contract.primaryColor}, accent ${contract.accentColor}, mode ${contract.colorMode}`,
    `- Style: ${contract.paletteName} / ${contract.styleName}`,
    `- Nav: ${contract.navPattern}; layout ${contract.dominantLayoutPattern}; density ${contract.layoutDensity}`,
    `- Tone: ${contract.visualPersonality}, ${contract.keyEmotionalTone}`,
    `- Prefer ${contract.radiusScale}; ${contract.shadowScale}; ${contract.spacingScale}`,
    "- Keep sibling screens in the same visual family. Content and page structure may differ by screen purpose (e.g. auth vs app shell).",
  ];

  if (fingerprint?.trim()) {
    lines.push("", fingerprint.trim());
  }

  return lines.join("\n");
}
