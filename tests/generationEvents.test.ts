import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recoverStalledFrames } from "../lib/generation/frames";
import {
  adaptFrameEvent,
  isTerminalPersistedScreen,
} from "../lib/generation/events";
import type { CanvasFrameData } from "../components/canvas/types";

const COMPLETE_SCREEN = `function GeneratedScreen() {
  return null;
}
export default GeneratedScreen;
`;

describe("adaptFrameEvent", () => {
  it("maps frame_start / frame_done / code_chunk onto screen_* events", () => {
    assert.deepEqual(
      adaptFrameEvent(
        { type: "frame_start", frameId: "f1", screen: "Home" },
        "Home",
      ),
      { type: "screen_start", screen: "Home", frameId: "f1" },
    );

    assert.deepEqual(
      adaptFrameEvent(
        {
          type: "code_chunk",
          frameId: "f1",
          token: "abc",
        },
        "Home",
      ),
      {
        type: "code_chunk",
        screen: "Home",
        frameId: "f1",
        token: "abc",
      },
    );

    assert.deepEqual(
      adaptFrameEvent(
        {
          type: "frame_done",
          frameId: "f1",
          screen: "Home",
          content: COMPLETE_SCREEN,
          error: null,
        },
        "Home",
      ),
      {
        type: "screen_done",
        screen: "Home",
        frameId: "f1",
        content: COMPLETE_SCREEN,
        error: null,
      },
    );
  });
});

describe("isTerminalPersistedScreen", () => {
  it("treats empty error placeholders as pending while RUNNING", () => {
    assert.equal(
      isTerminalPersistedScreen({ state: "error", content: "" }, "RUNNING"),
      false,
    );
    assert.equal(
      isTerminalPersistedScreen(
        { state: "done", content: COMPLETE_SCREEN },
        "RUNNING",
      ),
      true,
    );
    assert.equal(
      isTerminalPersistedScreen({ state: "error", content: "" }, "FAILED"),
      true,
    );
  });
});

describe("recoverStalledFrames", () => {
  it("marks incomplete streaming and skeleton frames as error", () => {
    const frames = new Map<string, CanvasFrameData>([
      [
        "live",
        {
          id: "live",
          generationId: "gen_running",
          state: "streaming",
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
      [
        "stale",
        {
          id: "stale",
          generationId: "gen_old",
          state: "skeleton",
          x: 0,
          y: 0,
          w: 1280,
          h: 800,
          screenName: "Settings",
          platform: "web",
          content: "",
          editedContent: null,
          error: null,
        },
      ],
    ]);

    const recovered = recoverStalledFrames(frames);
    assert.equal(recovered.changed, true);
    assert.equal(recovered.frames.get("live")?.state, "error");
    assert.equal(recovered.frames.get("stale")?.state, "error");
  });
});
