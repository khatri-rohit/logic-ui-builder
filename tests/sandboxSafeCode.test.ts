import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureSandboxSafeCode } from "../lib/sandboxSafeCode";
import { validateSandboxRuntimeHazards } from "../lib/validation/sandboxRuntimeHazards";

describe("sandbox runtime hazards", () => {
  it("rejects Lucide icons used as Array.filter callbacks", () => {
    const code = `
import React from "react";
import { Circle } from "lucide-react";

function GeneratedScreen() {
  const initials = "Nora Voss".split(" ").filter(Circle).join("");
  return <main>{initials}</main>;
}

export default GeneratedScreen;
`;

    const result = validateSandboxRuntimeHazards(code);
    assert.equal(result.valid, false);
    assert.match(result.issues.join(" "), /filter/);
  });

  it("rejects new Map() when Map is imported from lucide-react", () => {
    const code = `
import React from "react";
import { Map } from "lucide-react";

function GeneratedScreen() {
  const lookup = new Map();
  return <main>{String(lookup.size)}</main>;
}

export default GeneratedScreen;
`;

    const result = validateSandboxRuntimeHazards(code);
    assert.equal(result.valid, false);
    assert.match(result.issues.join(" "), /constructed with new/);
  });
});

describe("ensureSandboxSafeCode", () => {
  it("returns a fallback screen instead of shipping .filter(Circle)", async () => {
    const raw = `
import React from "react";
import { Circle } from "lucide-react";

function GeneratedScreen() {
  return <main>{"Ada Lovelace".split(" ").filter(Circle).join("")}</main>;
}

export default GeneratedScreen;
`;

    const safe = await ensureSandboxSafeCode(raw);
    assert.equal(safe.usedFallback, true);
    assert.match(safe.code, /Layout placeholder/);
    assert.doesNotMatch(safe.code, /\.filter\(Circle\)/);
  });

  it("keeps valid initials helpers", async () => {
    const raw = `
import React from "react";

function initialsFor(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("");
}

function GeneratedScreen() {
  return <main>{initialsFor("Nora Voss")}</main>;
}

export default GeneratedScreen;
`;

    const safe = await ensureSandboxSafeCode(raw);
    assert.equal(safe.usedFallback, false, safe.issues.join("; "));
    assert.match(safe.code, /\.filter\(Boolean\)/);
  });
});
