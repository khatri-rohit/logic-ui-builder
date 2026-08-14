import type { DesignSystemSnapshot, WebAppSpec } from "@/lib/types";

export type { DesignSystemSnapshot };

type Rgb = { r: number; g: number; b: number };

export function normalizeHexColor(hex: string): string {
  const raw = hex.trim();
  if (raw.startsWith("#") && raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (raw.startsWith("#") && raw.length === 7) {
    return raw.toLowerCase();
  }
  return raw;
}

function parseHex(hex: string): Rgb | null {
  const n = normalizeHexColor(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) return null;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Tint strength from personality + emotional tone (intent-driven, not global dogma). */
export function resolveTintStrength(
  personality?: WebAppSpec["visualPersonality"],
  tone?: string,
): DesignSystemSnapshot["tintStrength"] {
  const t = (tone || "").toLowerCase();
  if (
    personality === "expressive-brand" ||
    personality === "conversational-warm" ||
    t === "energetic" ||
    t === "playful"
  ) {
    return "brand";
  }
  if (
    personality === "corporate-precision" ||
    personality === "editorial-bold" ||
    t === "urgent"
  ) {
    return "restrained";
  }
  // minimal-utility, data-dense, calm/trustworthy/authoritative → near-neutral
  return "neutral";
}

function tintAmount(
  strength: DesignSystemSnapshot["tintStrength"],
  isDark: boolean,
): { surface: number; elevated: number; overlay: number } {
  if (strength === "brand") {
    return isDark
      ? { surface: 0.14, elevated: 0.18, overlay: 0.22 }
      : { surface: 0.08, elevated: 0.11, overlay: 0.14 };
  }
  if (strength === "restrained") {
    return isDark
      ? { surface: 0.07, elevated: 0.1, overlay: 0.13 }
      : { surface: 0.04, elevated: 0.06, overlay: 0.08 };
  }
  return isDark
    ? { surface: 0.02, elevated: 0.03, overlay: 0.045 }
    : { surface: 0.015, elevated: 0.025, overlay: 0.04 };
}

/**
 * Build a locked Design System Snapshot from Stage 1 spec.
 * Surfaces are derived from primary + personality — not a global gray template.
 */
export function buildDesignSystemSnapshot(
  spec: Pick<
    WebAppSpec,
    | "primaryColor"
    | "accentColor"
    | "colorMode"
    | "visualPersonality"
    | "keyEmotionalTone"
  >,
): DesignSystemSnapshot {
  const isDark = spec.colorMode === "dark";
  const primary = normalizeHexColor(spec.primaryColor || "#2563eb");
  const accent = normalizeHexColor(spec.accentColor || "#f59e0b");
  const primaryRgb = parseHex(primary) ?? { r: 37, g: 99, b: 235 };
  const tintStrength = resolveTintStrength(
    spec.visualPersonality,
    spec.keyEmotionalTone,
  );
  const amounts = tintAmount(tintStrength, isDark);

  const baseSurface = isDark
    ? { r: 15, g: 15, b: 15 }
    : { r: 251, g: 251, b: 250 };
  const baseElevated = isDark
    ? { r: 26, g: 26, b: 26 }
    : { r: 244, g: 244, b: 242 };
  const baseOverlay = isDark
    ? { r: 36, g: 36, b: 36 }
    : { r: 236, g: 236, b: 234 };

  const surface = toHex(mix(baseSurface, primaryRgb, amounts.surface));
  const surfaceElevated = toHex(
    mix(baseElevated, primaryRgb, amounts.elevated),
  );
  const surfaceOverlay = toHex(mix(baseOverlay, primaryRgb, amounts.overlay));

  const textPrimary = isDark ? "#f2f2ef" : "#10100e";
  const textSecondary = isDark
    ? "rgba(242,242,239,0.66)"
    : "rgba(16,16,14,0.66)";
  const textTertiary = isDark
    ? "rgba(242,242,239,0.42)"
    : "rgba(16,16,14,0.42)";

  const border = isDark
    ? "rgba(255,255,255,0.10)"
    : withAlpha(toHex(mix({ r: 15, g: 15, b: 15 }, primaryRgb, 0.25)), 0.12);

  return {
    surface,
    surfaceElevated,
    surfaceOverlay,
    border,
    textPrimary,
    textSecondary,
    textTertiary,
    primary,
    primaryMuted: withAlpha(primary, 0.14),
    accent,
    accentMuted: withAlpha(accent, 0.14),
    success: accent,
    warning: withAlpha(primary, 0.8),
    error: isDark ? "#f87171" : "#ef4444",
    colorMode: isDark ? "dark" : "light",
    tintStrength,
  };
}

/** Attach snapshot to spec (idempotent). */
export function withDesignSystem(spec: WebAppSpec): WebAppSpec {
  if (spec.designSystem) {
    return spec;
  }
  return {
    ...spec,
    designSystem: buildDesignSystemSnapshot(spec),
  };
}

/** Prefer existing snapshot on spec; otherwise build. */
export function resolveDesignSystem(spec: WebAppSpec): DesignSystemSnapshot {
  return spec.designSystem ?? buildDesignSystemSnapshot(spec);
}

export function snapshotToCssVarEntries(
  snapshot: DesignSystemSnapshot,
): Array<[string, string]> {
  return [
    ["--surface", snapshot.surface],
    ["--surface-elevated", snapshot.surfaceElevated],
    ["--surface-overlay", snapshot.surfaceOverlay],
    ["--border", snapshot.border],
    ["--text-primary", snapshot.textPrimary],
    ["--text-secondary", snapshot.textSecondary],
    ["--text-tertiary", snapshot.textTertiary],
    ["--primary", snapshot.primary],
    ["--primary-muted", snapshot.primaryMuted],
    ["--accent", snapshot.accent],
    ["--accent-muted", snapshot.accentMuted],
    ["--success", snapshot.success],
    ["--warning", snapshot.warning],
    ["--error", snapshot.error],
  ];
}

function buildTokenStyleInner(snapshot: DesignSystemSnapshot): string {
  const entries = snapshotToCssVarEntries(snapshot)
    .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
    .join(", ");
  return `${entries}, fontFamily: "'Inter', system-ui, sans-serif"`;
}

const DSS_BLOCK_RE =
  /\/\*__DSS_START__\*\/[\s\S]*?\/\*__DSS_END__\*\//g;

const ROOT_RETURN_OPEN_RE =
  /return\s*\(\s*\n?\s*<([A-Za-z][\w.]*)(\s[^>]*?)?\s*(\/)?>/;

/**
 * Ensure GeneratedScreen root sets locked CSS variables.
 * Idempotent — safe to run on regen.
 */
export function ensureDesignTokensOnRoot(
  code: string,
  snapshot: DesignSystemSnapshot,
): string {
  const inner = buildTokenStyleInner(snapshot);
  const dssInner = `/*__DSS_START__*/ ${inner} /*__DSS_END__*/`;

  let next = code.replace(DSS_BLOCK_RE, "");
  next = next.replace(/style=\{\{\s*\}\}/g, "");

  const match = ROOT_RETURN_OPEN_RE.exec(next);
  if (!match) {
    return next;
  }

  const full = match[0];
  const tag = match[1];
  const attrs = match[2] ?? "";
  const selfClosing = Boolean(match[3]);
  const start = match.index;

  let newOpen: string;
  if (/style=\{\{/.test(attrs)) {
    const mergedAttrs = attrs.replace(
      /style=\{\{/,
      `style={{ ${dssInner}, `,
    );
    newOpen = `return (\n    <${tag}${mergedAttrs}${selfClosing ? " />" : ">"}`;
  } else {
    const styleAttr = ` style={{ ${dssInner} } as React.CSSProperties}`;
    newOpen = `return (\n    <${tag}${attrs}${styleAttr}${selfClosing ? " />" : ">"}`;
  }

  return next.slice(0, start) + newOpen + next.slice(start + full.length);
}

/** Contrast hint for primary button text. */
export function primaryButtonTextColor(primaryHex: string): "white" | "black" {
  const rgb = parseHex(primaryHex);
  if (!rgb) return "white";
  return relativeLuminance(rgb) > 0.45 ? "black" : "white";
}
