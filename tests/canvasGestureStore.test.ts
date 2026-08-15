import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanvasGestureStore } from "../components/canvas/CanvasGestureContext";

describe("createCanvasGestureStore", () => {
  it("tracks overlapping begin/end without going negative", () => {
    const store = createCanvasGestureStore();
    assert.equal(store.isActive(), false);

    store.begin();
    store.begin();
    assert.equal(store.isActive(), true);

    store.end();
    assert.equal(store.isActive(), true);

    store.end();
    assert.equal(store.isActive(), false);

    store.end();
    assert.equal(store.isActive(), false);
  });

  it("reset clears a stuck gesture so teardown can resume", () => {
    const store = createCanvasGestureStore();
    let activeTransitions = 0;
    store.subscribe(() => {
      activeTransitions += 1;
    });

    store.begin();
    assert.equal(store.isActive(), true);
    assert.equal(activeTransitions, 1);

    store.reset();
    assert.equal(store.isActive(), false);
    assert.equal(activeTransitions, 2);

    store.reset();
    assert.equal(activeTransitions, 2);
  });
});
