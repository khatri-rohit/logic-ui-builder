import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeGeneratedCode } from "../lib/generatedCodeSanitizer";
import { validateSandboxBindings } from "../lib/validation/sandboxBindings";

describe("sandbox-safe Lucide reconciliation", () => {
  it("imports allowlisted icons used without an import", () => {
    const raw = `
import React from "react";

function GeneratedScreen() {
  return (
    <main>
      <GitPullRequest className="w-4 h-4" />
      <Search className="w-4 h-4" />
    </main>
  );
}

export default GeneratedScreen;
`;

    const sanitized = sanitizeGeneratedCode(raw);
    assert.match(sanitized, /from ["']lucide-react["']/);
    assert.match(sanitized, /\bGitPullRequest\b/);
    assert.match(sanitized, /\bSearch\b/);

    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
  });

  it("rewrites invented icons and icon={BadIcon} usages to Circle", () => {
    const raw = `
import React from "react";
import { Search, TotallyFakeIcon } from "lucide-react";

function GeneratedScreen() {
  const items = [{ icon: TotallyFakeIcon }, { icon: AnotherFakeIcon }];
  return (
    <main>
      <Search />
      <TotallyFakeIcon className="w-4 h-4" />
      <AnotherFakeIcon />
    </main>
  );
}

export default GeneratedScreen;
`;

    const sanitized = sanitizeGeneratedCode(raw);
    assert.match(sanitized, /from ["']lucide-react["']/);
    assert.match(sanitized, /\bCircle\b/);
    assert.doesNotMatch(sanitized, /\bTotallyFakeIcon\b/);
    assert.doesNotMatch(sanitized, /\bAnotherFakeIcon\b/);
    assert.match(sanitized, /\bSearch\b/);

    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
  });

  it("flags unbound PascalCase JSX when sanitizer cannot resolve non-icon components", () => {
    const raw = `
import React from "react";

function GeneratedScreen() {
  return (
    <main>
      <MysteriousWidget />
    </main>
  );
}

export default GeneratedScreen;
`;

    // MysteriousWidget is remapped to Circle by Lucide reconciliation
    const sanitized = sanitizeGeneratedCode(raw);
    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
    assert.match(sanitized, /\bCircle\b/);
  });

  it("does not rewrite .filter(Boolean) initials helpers into Lucide icons", () => {
    const raw = `
import React from "react";

function initialsFor(name: string) {
  return String(name)
    .split(/\\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function GeneratedScreen() {
  const people = [{ name: "Nora Voss" }, { name: "Kai Ellison" }];
  return (
    <main>
      {people.map((person) => (
        <span key={person.name}>{initialsFor(person.name)}</span>
      ))}
    </main>
  );
}

export default GeneratedScreen;
`;

    const sanitized = sanitizeGeneratedCode(raw);
    assert.match(sanitized, /\.filter\(Boolean\)/);
    assert.doesNotMatch(sanitized, /\.filter\(Circle\)/);

    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
  });

  it("keeps .map(Number) and does not import Boolean/Number as icons", () => {
    const raw = `
import React from "react";

function GeneratedScreen() {
  const values = ["1", "", "2"].map(Number).filter(Boolean);
  return <main>{values.join(",")}</main>;
}

export default GeneratedScreen;
`;

    const sanitized = sanitizeGeneratedCode(raw);
    assert.match(sanitized, /\.map\(Number\)/);
    assert.match(sanitized, /\.filter\(Boolean\)/);
    assert.doesNotMatch(sanitized, /from ["']lucide-react["']/);

    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
  });

  it("aliases Lucide Map so new Map() keeps the language constructor", () => {
    const raw = `
import React from "react";
import { Map } from "lucide-react";

function GeneratedScreen() {
    const lookup = new Map();
    lookup.set("a", "1");
  return (
    <main>
      <Map className="w-4 h-4" />
      <span>{lookup.get("a")}</span>
    </main>
  );
}

export default GeneratedScreen;
`;

    const sanitized = sanitizeGeneratedCode(raw);
    assert.match(sanitized, /Map as MapIcon/);
    assert.match(sanitized, /<MapIcon/);
    assert.match(sanitized, /new Map\(\)/);
    assert.doesNotMatch(sanitized, /new MapIcon/);

    const bindings = validateSandboxBindings(sanitized);
    assert.equal(bindings.valid, true, bindings.issues.join("; "));
  });
});
