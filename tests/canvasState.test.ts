import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCanvasSnapshotV1,
  isPersistedGenerationScreen,
} from "../lib/canvas-state";
import { parseGenerationScreens } from "../lib/utils";

describe("canvas-state compiling coerce", () => {
  it("accepts legacy compiling frames as streaming", () => {
    assert.equal(
      isPersistedGenerationScreen({
        id: "f1",
        state: "compiling",
        x: 0,
        y: 0,
        w: 1280,
        h: 800,
        screenName: "Home",
        content: "",
        editedContent: null,
        error: null,
      }),
      true,
    );
  });

  it("accepts a snapshot whose frames used compiling", () => {
    assert.equal(
      isCanvasSnapshotV1({
        version: 1,
        camera: { x: 0, y: 0, k: 1 },
        activeFrameId: null,
        selectedFrameId: null,
        selectedGenerationId: null,
        savedAt: "2026-08-16T00:00:00.000Z",
        frames: [
          {
            id: "f1",
            generationId: "gen_1",
            state: "compiling",
            x: 0,
            y: 0,
            w: 1280,
            h: 800,
            screenName: "Home",
            platform: "web",
            content: "",
            editedContent: null,
            error: null,
          },
        ],
      }),
      true,
    );
  });

  it("coerces compiling to streaming when parsing persisted screens", () => {
    const screens = parseGenerationScreens([
      {
        id: "f1",
        state: "compiling",
        x: 0,
        y: 0,
        w: 1280,
        h: 800,
        screenName: "Home",
        content: "",
        editedContent: null,
        error: null,
      },
    ]);

    assert.equal(screens[0]?.state, "streaming");
  });
});
