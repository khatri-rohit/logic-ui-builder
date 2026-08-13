import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDesignSystemSnapshot,
  ensureDesignTokensOnRoot,
  resolveTintStrength,
  withDesignSystem,
} from "../lib/designSystemSnapshot";
import type { WebAppSpec } from "../lib/types";

function baseSpec(overrides: Partial<WebAppSpec> = {}): WebAppSpec {
  return {
    screens: ["Home"],
    navPattern: "top-nav",
    platform: "web",
    colorMode: "light",
    primaryColor: "#e11d48",
    accentColor: "#f59e0b",
    stylingLib: "tailwind",
    layoutDensity: "comfortable",
    components: [],
    ...overrides,
  };
}

const SAMPLE_SCREEN = [
  'import React from "react";',
  "",
  "function GeneratedScreen() {",
  "  return (",
  '    <div className="min-h-0 w-full bg-[var(--surface)]">',
  "      <h1>Hello</h1>",
  "    </div>",
  "  );",
  "}",
  "",
  "export default GeneratedScreen;",
].join("\n");

const SAMPLE_WITH_STYLE = [
  'import React from "react";',
  "",
  "function GeneratedScreen() {",
  "  return (",
  '    <main style={{ padding: 16 }} className="w-full">',
  "      Content",
  "    </main>",
  "  );",
  "}",
  "",
  "export default GeneratedScreen;",
].join("\n");

describe("designSystemSnapshot derivation", () => {
  it("uses brand tint for expressive / playful intent", () => {
    assert.equal(
      resolveTintStrength("expressive-brand", "playful"),
      "brand",
    );
    const snap = buildDesignSystemSnapshot(
      baseSpec({
        visualPersonality: "expressive-brand",
        keyEmotionalTone: "playful",
        primaryColor: "#e11d48",
      }),
    );
    assert.equal(snap.tintStrength, "brand");
    assert.equal(snap.primary, "#e11d48");
    assert.notEqual(snap.surface.toLowerCase(), "#fbfbfa");
  });

  it("keeps near-neutral surfaces for minimal-utility", () => {
    assert.equal(resolveTintStrength("minimal-utility", "calm"), "neutral");
    const snap = buildDesignSystemSnapshot(
      baseSpec({
        visualPersonality: "minimal-utility",
        keyEmotionalTone: "calm",
        primaryColor: "#2563eb",
      }),
    );
    assert.equal(snap.tintStrength, "neutral");
    assert.match(snap.surface, /^#[0-9a-f]{6}$/i);
  });

  it("uses restrained tint for corporate-precision", () => {
    assert.equal(
      resolveTintStrength("corporate-precision", "trustworthy"),
      "restrained",
    );
  });

  it("attaches designSystem once via withDesignSystem", () => {
    const first = withDesignSystem(baseSpec());
    assert.ok(first.designSystem);
    const second = withDesignSystem(first);
    assert.equal(second.designSystem, first.designSystem);
  });

  it("derives dark-mode surfaces for dark colorMode", () => {
    const snap = buildDesignSystemSnapshot(
      baseSpec({ colorMode: "dark", primaryColor: "#3b82f6" }),
    );
    assert.equal(snap.colorMode, "dark");
    assert.equal(snap.textPrimary, "#f2f2ef");
  });
});

describe("ensureDesignTokensOnRoot bake", () => {
  it("bakes locked CSS variables onto the root element", () => {
    const snap = buildDesignSystemSnapshot(
      baseSpec({ visualPersonality: "expressive-brand" }),
    );
    const baked = ensureDesignTokensOnRoot(SAMPLE_SCREEN, snap);
    assert.match(baked, /__DSS_START__/);
    assert.match(baked, /"--surface":/);
    assert.match(baked, /"--primary":/);
    assert.ok(baked.includes(JSON.stringify(snap.primary)));
    assert.match(baked, /fontFamily:/);
  });

  it("is idempotent across repeated bakes", () => {
    const snap = buildDesignSystemSnapshot(baseSpec());
    const once = ensureDesignTokensOnRoot(SAMPLE_SCREEN, snap);
    const twice = ensureDesignTokensOnRoot(once, snap);
    const count = (twice.match(/__DSS_START__/g) || []).length;
    assert.equal(count, 1);
    assert.match(twice, /"--primary":/);
  });

  it("merges into an existing style prop", () => {
    const snap = buildDesignSystemSnapshot(baseSpec());
    const baked = ensureDesignTokensOnRoot(SAMPLE_WITH_STYLE, snap);
    assert.match(baked, /__DSS_START__/);
    assert.match(baked, /padding:\s*16/);
    assert.match(baked, /"--surface":/);
  });
});
