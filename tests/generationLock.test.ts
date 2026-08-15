import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideGenerationLock,
  GENERATION_LOCK_TTL_MS,
} from "../lib/generationLock";
import { parseGenerationScreens } from "../lib/utils";
import { isProbablyCompleteScreen } from "../lib/sandboxFallbackScreen";

describe("decideGenerationLock", () => {
  const now = new Date("2026-08-16T10:00:00.000Z");

  it("allows when project is ACTIVE and nothing is RUNNING", () => {
    assert.deepEqual(
      decideGenerationLock({
        projectStatus: "ACTIVE",
        runningGenerations: [],
        now,
      }),
      { action: "allow" },
    );
  });

  it("blocks when a RUNNING generation was updated within the TTL", () => {
    assert.deepEqual(
      decideGenerationLock({
        projectStatus: "GENERATING",
        runningGenerations: [
          {
            id: "gen_live",
            updatedAt: new Date(now.getTime() - 60_000),
          },
        ],
        now,
      }),
      { action: "block", reason: "live_running" },
    );
  });

  it("recovers stale GENERATING with no live RUNNING generation", () => {
    assert.deepEqual(
      decideGenerationLock({
        projectStatus: "GENERATING",
        runningGenerations: [
          {
            id: "gen_stale",
            updatedAt: new Date(now.getTime() - GENERATION_LOCK_TTL_MS - 1),
          },
        ],
        now,
      }),
      {
        action: "recover",
        recoveredGenerationIds: ["gen_stale"],
      },
    );
  });

  it("recovers GENERATING even when there are no RUNNING rows", () => {
    assert.deepEqual(
      decideGenerationLock({
        projectStatus: "GENERATING",
        runningGenerations: [],
        now,
      }),
      {
        action: "recover",
        recoveredGenerationIds: [],
      },
    );
  });
});

describe("parseGenerationScreens", () => {
  const validScreen = {
    id: "frame_1",
    state: "done",
    x: 0,
    y: 0,
    w: 1280,
    h: 800,
    screenName: "Home",
    content: "export default function GeneratedScreen() { return null }",
    editedContent: null,
    error: null,
  };

  it("keeps valid siblings when one screen is invalid", () => {
    const screens = parseGenerationScreens([
      validScreen,
      {
        id: "frame_bad",
        state: "error",
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        screenName: "Broken",
        content: "",
        editedContent: null,
        error: "bad",
      },
      {
        ...validScreen,
        id: "frame_2",
        state: "error",
        content: "",
        error: "interrupted",
      },
    ]);

    assert.equal(screens.length, 2);
    assert.equal(screens[0]?.id, "frame_1");
    assert.equal(screens[1]?.id, "frame_2");
  });

  it("returns empty for non-array payloads", () => {
    assert.deepEqual(parseGenerationScreens(null), []);
    assert.deepEqual(parseGenerationScreens({ screens: [] } as never), []);
  });
});

describe("frame regenerate failure contract", () => {
  it("does not treat incomplete source as a successful screen", () => {
    assert.equal(isProbablyCompleteScreen(""), false);
    assert.equal(isProbablyCompleteScreen("const x = 1"), false);
    assert.equal(
      isProbablyCompleteScreen(
        `function GeneratedScreen(){return null}\nexport default GeneratedScreen;`,
      ),
      true,
    );
  });
});
