import { WebAppSpec, ComponentTreeNode } from "@/lib/types";
import prisma from "@/lib/prisma";

export type ScreenClass =
  | "simple-static"
  | "data-heavy"
  | "form-interactive"
  | "marketing-rich"
  | "complex-layout"
  | "unknown";

const SCREEN_CLASS_KEYWORDS: Record<ScreenClass, string[]> = {
  "simple-static": [
    "login",
    "signin",
    "signup",
    "register",
    "about",
    "contact",
    "profile",
    "404",
    "empty",
    "splash",
    "welcome",
    "basic",
    "simple",
  ],
  "data-heavy": [
    "dashboard",
    "analytics",
    "metrics",
    "chart",
    "graph",
    "report",
    "data",
    "table",
    "grid",
    "feed",
    "timeline",
    "log",
    "monitor",
    "stats",
    "overview",
    "kpi",
  ],
  "form-interactive": [
    "form",
    "checkout",
    "payment",
    "wizard",
    "step",
    "onboarding",
    "survey",
    "quiz",
    "settings",
    "edit",
    "create",
    "input",
    "multi-step",
    "workflow",
    "configure",
  ],
  "marketing-rich": [
    "landing",
    "home",
    "hero",
    "pricing",
    "testimonial",
    "feature",
    "faq",
    "blog",
    "portfolio",
    "case study",
    "casestudy",
    "campaign",
    "promo",
    "showcase",
    "gallery",
  ],
  "complex-layout": [
    "admin",
    "cms",
    "editor",
    "builder",
    "workspace",
    "multi",
    "split",
    "hybrid",
    "nested",
    "modal",
    "drawer",
    "sidepanel",
    "master-detail",
    "inbox",
    "calendar",
    "kanban",
  ],
  unknown: [],
};

const DATA_COMPONENTS = new Set([
  "chart",
  "table",
  "datagrid",
  "graph",
  "metric",
  "stat",
  "kpi",
  "recharts",
  "plot",
  "analytics",
]);

const FORM_COMPONENTS = new Set([
  "form",
  "input",
  "select",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "datepicker",
  "upload",
  "wizard",
  "stepper",
]);

const MARKETING_COMPONENTS = new Set([
  "hero",
  "testimonial",
  "pricingcard",
  "featurecard",
  "faq",
  "cta",
  "badge",
  "marquee",
  "carousel",
]);

function scoreKeywords(screenName: string, keywords: string[]): number {
  const normalized = screenName.toLowerCase();
  return keywords.reduce((score, kw) => {
    if (normalized.includes(kw)) return score + 1;
    return score;
  }, 0);
}

function scoreComponents(
  components: string[],
  targetSet: Set<string>,
): number {
  return components.reduce((score, c) => {
    const normalized = c.toLowerCase().replace(/[^a-z]/g, "");
    for (const target of targetSet) {
      if (normalized.includes(target)) return score + 1;
    }
    return score;
  }, 0);
}

export function classifyScreen(
  spec: WebAppSpec,
  screenName: string,
  tree: ComponentTreeNode[],
): ScreenClass {
  const scores: Record<ScreenClass, number> = {
    "simple-static": 0,
    "data-heavy": 0,
    "form-interactive": 0,
    "marketing-rich": 0,
    "complex-layout": 0,
    unknown: 0,
  };

  // Keyword scoring from screen name
  for (const cls of Object.keys(SCREEN_CLASS_KEYWORDS) as ScreenClass[]) {
    scores[cls] += scoreKeywords(screenName, SCREEN_CLASS_KEYWORDS[cls]);
  }

  // Tree component scoring
  const node = tree.find((n) => n.screen === screenName);
  const components = node?.components ?? spec.components ?? [];

  scores["data-heavy"] += scoreComponents(components, DATA_COMPONENTS) * 2;
  scores["form-interactive"] +=
    scoreComponents(components, FORM_COMPONENTS) * 2;
  scores["marketing-rich"] +=
    scoreComponents(components, MARKETING_COMPONENTS) * 2;

  // Component count heuristic
  const componentCount = components.length;
  if (componentCount >= 12) {
    scores["complex-layout"] += 2;
  } else if (componentCount <= 4) {
    scores["simple-static"] += 1;
  }

  // Spec-level hints
  if (spec.dominantLayoutPattern === "dashboard-grid") {
    scores["data-heavy"] += 2;
  }
  if (spec.dominantLayoutPattern === "full-page-sections") {
    scores["marketing-rich"] += 1;
  }
  if (spec.primaryInteraction === "input") {
    scores["form-interactive"] += 1;
  }
  if (spec.primaryInteraction === "monitor") {
    scores["data-heavy"] += 1;
  }
  if (spec.navPattern === "hybrid" || spec.navPattern === "sidebar") {
    scores["complex-layout"] += 1;
  }
  if (spec.contentDensityScore && spec.contentDensityScore >= 4) {
    scores["complex-layout"] += 1;
  }

  const winner = (Object.keys(scores) as ScreenClass[]).reduce((best, cls) =>
    scores[cls] > scores[best] ? cls : best,
  );

  return scores[winner] > 0 ? winner : "unknown";
}

// --- Router cache ---

interface CacheEntry {
  priority: string[];
  expiresAt: number;
}

const routerCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(
  preferredModel: string | null,
  screenClass: ScreenClass,
): string {
  return `${preferredModel ?? "none"}:${screenClass}`;
}

// --- Dynamic priority builder ---

export async function buildDynamicModelPriority(
  staticPriority: string[],
  screenClass: ScreenClass,
  preferredModel: string | null,
): Promise<string[]> {
  if (screenClass === "unknown") {
    return buildModelPriority(preferredModel, staticPriority);
  }

  const cacheKey = getCacheKey(preferredModel, screenClass);
  const cached = routerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.priority;
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const rows = await prisma.generationTelemetry.findMany({
    where: {
      screenClass: screenClass,
      stage: "stage3",
      createdAt: { gte: since },
    },
    select: {
      model: true,
      success: true,
      latencyMs: true,
    },
  });

  // Compute per-model stats in JS
  const stats = new Map<
    string,
    { total: number; successes: number; totalLatency: number }
  >();

  for (const row of rows) {
    const s = stats.get(row.model) ?? {
      total: 0,
      successes: 0,
      totalLatency: 0,
    };
    s.total += 1;
    if (row.success) s.successes += 1;
    s.totalLatency += row.latencyMs;
    stats.set(row.model, s);
  }

  const scored = [...stats.entries()]
    .map(([model, s]) => {
      const successRate = s.total > 0 ? s.successes / s.total : 0;
      const avgLatency = s.total > 0 ? s.totalLatency / s.total : 60_000;
      // Score: successRate weighted 60%, speed weighted 40%
      const speedScore = Math.min(1, 30_000 / Math.max(avgLatency, 1));
      const score = successRate * 0.6 + speedScore * 0.4;
      return { model, score, total: s.total };
    })
    .filter((s) => s.total >= 3) // require at least 3 samples
    .sort((a, b) => b.score - a.score);

  // If insufficient telemetry, fall back to static priority
  if (scored.length === 0) {
    const fallback = buildModelPriority(preferredModel, staticPriority);
    routerCache.set(cacheKey, { priority: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
    return fallback;
  }

  // Build final priority:
  // 1. preferredModel (if any)
  // 2. Telemetry-ranked models that are also in staticPriority
  // 3. Any remaining staticPriority models not in telemetry
  const telemetryModels = scored.map((s) => s.model);
  const staticSet = new Set(staticPriority);

  const ordered = new Set<string>();

  if (preferredModel && staticSet.has(preferredModel)) {
    ordered.add(preferredModel);
  }

  for (const m of telemetryModels) {
    if (staticSet.has(m)) ordered.add(m);
  }

  for (const m of staticPriority) {
    ordered.add(m);
  }

  const result = [...ordered];
  routerCache.set(cacheKey, { priority: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

// Re-export the simple priority builder so callers don't need to import from generation.ts
export function buildModelPriority(
  preferredModel: string | null,
  defaults: readonly string[],
): string[] {
  if (!preferredModel) {
    return [...defaults];
  }

  if (defaults.includes(preferredModel)) {
    return [
      preferredModel,
      ...defaults.filter((model) => model !== preferredModel),
    ];
  }

  return [preferredModel, ...defaults];
}
