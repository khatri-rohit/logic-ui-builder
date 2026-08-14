import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldAutoStartProjectGeneration } from "../lib/projects/autoStart";
import type { ProjectDetail, ProjectGeneration } from "../lib/api/types";

function baseProject(
  overrides: Partial<ProjectDetail> &
    Pick<ProjectDetail, "status" | "frames" | "generations">,
): Pick<ProjectDetail, "status" | "frames" | "generations"> {
  return {
    status: overrides.status,
    frames: overrides.frames,
    generations: overrides.generations,
  };
}

function generation(
  overrides: Partial<ProjectGeneration> &
    Pick<ProjectGeneration, "generationId" | "status">,
): ProjectGeneration {
  return {
    generationId: overrides.generationId,
    model: "test-model",
    platform: "web",
    spec: null,
    screens: overrides.screens ?? [],
    status: overrides.status,
    terminalAt: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("shouldAutoStartProjectGeneration", () => {
  it("starts for PENDING projects with no screens", () => {
    assert.equal(
      shouldAutoStartProjectGeneration(
        baseProject({
          status: "PENDING",
          frames: [],
          generations: [],
        }),
      ),
      true,
    );
  });

  it("does not start for ACTIVE projects even with empty frames (stale cache)", () => {
    assert.equal(
      shouldAutoStartProjectGeneration(
        baseProject({
          status: "ACTIVE",
          frames: [],
          generations: [],
        }),
      ),
      false,
    );
  });

  it("does not start when a COMPLETED generation already has screens", () => {
    assert.equal(
      shouldAutoStartProjectGeneration(
        baseProject({
          status: "PENDING",
          frames: [],
          generations: [
            generation({
              generationId: "gen-1",
              status: "COMPLETED",
              screens: [
                {
                  id: "frame-1",
                  state: "done",
                  x: 0,
                  y: 0,
                  w: 1280,
                  h: 800,
                  screenName: "Home",
                  content: "import React from 'react'",
                  editedContent: null,
                  error: null,
                },
              ],
            }),
          ],
        }),
      ),
      false,
    );
  });

  it("does not start when a generation is RUNNING (reconnect instead)", () => {
    assert.equal(
      shouldAutoStartProjectGeneration(
        baseProject({
          status: "GENERATING",
          frames: [],
          generations: [
            generation({
              generationId: "gen-running",
              status: "RUNNING",
            }),
          ],
        }),
      ),
      false,
    );
  });

  it("does not start for ARCHIVED projects", () => {
    assert.equal(
      shouldAutoStartProjectGeneration(
        baseProject({
          status: "ARCHIVED",
          frames: [],
          generations: [],
        }),
      ),
      false,
    );
  });
});
