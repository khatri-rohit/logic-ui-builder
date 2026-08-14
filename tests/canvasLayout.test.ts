import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectBoundsFromGenerations,
  getGenerationLayout,
  mergeExistingFrameBounds,
} from "../lib/canvasLayout";

describe("getGenerationLayout row placement", () => {
  it("places the first generation at y=0", () => {
    const positions = getGenerationLayout([], [
      { name: "Home", w: 1280, h: 800 },
      { name: "Pricing", w: 1280, h: 700 },
    ]);
    assert.deepEqual(positions, [
      { x: 0, y: 0 },
      { x: 1380, y: 0 },
    ]);
  });

  it("starts a new row below the tallest existing frame (auto-fit height)", () => {
    // Stale DB height would be ~900; live canvas auto-fit is 2400.
    const existing = [
      { id: "a", x: 0, y: 0, w: 1280, h: 900 },
      { id: "b", x: 1380, y: 0, w: 1280, h: 2400 },
    ];
    const positions = getGenerationLayout(existing, [
      { name: "Landing", w: 1280, h: 800 },
    ]);
    assert.equal(positions[0]?.x, 0);
    assert.equal(positions[0]?.y, 2400 + 100);
  });

  it("prefers live canvas height over stale DB height when merging", () => {
    const db = [{ id: "a", x: 0, y: 0, w: 1280, h: 800 }];
    const live = [{ id: "a", x: 0, y: 0, w: 1280, h: 2200 }];
    const merged = mergeExistingFrameBounds(db, live);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.h, 2200);

    const positions = getGenerationLayout(merged, [
      { name: "Next", w: 1024, h: 700 },
    ]);
    assert.equal(positions[0]?.y, 2200 + 100);
  });

  it("excludes the in-progress generation when collecting bounds", () => {
    const bounds = collectBoundsFromGenerations(
      [
        {
          id: "gen-old",
          screens: [{ id: "1", x: 0, y: 0, w: 1280, h: 2000 }],
        },
        {
          id: "gen-new",
          screens: [{ id: "2", x: 0, y: 0, w: 100, h: 100 }],
        },
      ],
      "gen-new",
    );
    assert.equal(bounds.length, 1);
    assert.equal(bounds[0]?.id, "1");

    const positions = getGenerationLayout(bounds, [
      { name: "Screen", w: 1280, h: 800 },
    ]);
    assert.equal(positions[0]?.y, 2000 + 100);
  });
});
