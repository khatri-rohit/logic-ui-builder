import { extractDependencies } from "@/lib/dependencyExtractor";
import { sanitizeGeneratedCode } from "@/lib/generatedCodeSanitizer";
import { buildSandboxFallbackScreen } from "@/lib/sandboxFallbackScreen";
import { validateCompile } from "@/lib/validation/compileValidator";
import { validateSandboxBindings } from "@/lib/validation/sandboxBindings";
import { validateSandboxRuntimeHazards } from "@/lib/validation/sandboxRuntimeHazards";

export interface SandboxSafeCode {
  code: string;
  usedFallback: boolean;
  issues: string[];
}

async function collectSandboxIssues(code: string): Promise<string[]> {
  const compile = await validateCompile(code);
  const bindings = validateSandboxBindings(code);
  const hazards = validateSandboxRuntimeHazards(code);
  const deps = extractDependencies(code);

  return [
    ...compile.issues,
    ...bindings.issues,
    ...hazards.issues,
    ...deps.unknownPackages.map((pkg) => `Unsupported sandbox package "${pkg}"`),
  ];
}

/**
 * Last gate before a frame is persisted or mounted. Always returns TSX that
 * compiles, binds, and is safe for the single-file Sandpack iframe.
 */
export async function ensureSandboxSafeCode(
  raw: string | null | undefined,
): Promise<SandboxSafeCode> {
  const sanitized = sanitizeGeneratedCode(raw ?? "");
  const issues = await collectSandboxIssues(sanitized);

  if (issues.length === 0) {
    return { code: sanitized, usedFallback: false, issues: [] };
  }

  const fallback = buildSandboxFallbackScreen();
  return { code: fallback, usedFallback: true, issues };
}
