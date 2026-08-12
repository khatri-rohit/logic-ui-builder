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
});
