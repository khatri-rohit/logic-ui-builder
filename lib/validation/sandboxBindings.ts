import { ALLOWED_LUCIDE_ICON_SET } from "@/lib/lucideAllowlist";
import { SANDBOX_LANGUAGE_GLOBALS } from "@/lib/sandboxLanguageGlobals";
import * as ts from "typescript";

export interface SandboxBindingIssue {
  name: string;
  kind: "jsx" | "identifier";
}

export interface SandboxBindingResult {
  valid: boolean;
  issues: string[];
  unbound: SandboxBindingIssue[];
}

const INTRINSIC_TAGS = new Set([
  "Fragment",
  "Suspense",
  "StrictMode",
  "Profiler",
]);

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function collectImportBindings(sourceFile: ts.SourceFile): Set<string> {
  const bindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;

    if (clause.name) bindings.add(clause.name.text);

    const named = clause.namedBindings;
    if (!named) continue;

    if (ts.isNamespaceImport(named)) {
      bindings.add(named.name.text);
      continue;
    }

    for (const element of named.elements) {
      bindings.add(element.name.text);
    }
  }

  return bindings;
}

function collectLocalBindings(sourceFile: ts.SourceFile): Set<string> {
  const locals = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      locals.add(node.name.text);
    }
    if (ts.isClassDeclaration(node) && node.name) {
      locals.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      locals.add(node.name.text);
    }
    if (
      (ts.isParameter(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
    ) {
      locals.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return locals;
}

function collectUnboundComponentUsages(
  sourceFile: ts.SourceFile,
  known: Set<string>,
): SandboxBindingIssue[] {
  const unbound: SandboxBindingIssue[] = [];
  const seen = new Set<string>();

  const add = (name: string, kind: SandboxBindingIssue["kind"]) => {
    if (!isPascalCase(name)) return;
    if (INTRINSIC_TAGS.has(name)) return;
    if (known.has(name)) return;
    if (
      kind === "identifier" &&
      SANDBOX_LANGUAGE_GLOBALS.has(name)
    ) {
      return;
    }
    if (
      kind === "jsx" &&
      SANDBOX_LANGUAGE_GLOBALS.has(name) &&
      !ALLOWED_LUCIDE_ICON_SET.has(name)
    ) {
      return;
    }
    const key = `${kind}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    unbound.push({ name, kind });
  };

  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxClosingElement(node)) &&
      ts.isIdentifier(node.tagName)
    ) {
      add(node.tagName.text, "jsx");
    }

    // icon={GitPullRequest} / const x = <Icon />
    if (
      ts.isIdentifier(node) &&
      isPascalCase(node.text) &&
      !ts.isJsxOpeningElement(node.parent) &&
      !ts.isJsxSelfClosingElement(node.parent) &&
      !ts.isJsxClosingElement(node.parent)
    ) {
      const parent = node.parent;
      const usedAsValue =
        (ts.isJsxExpression(parent) && parent.expression === node) ||
        (ts.isPropertyAssignment(parent) && parent.initializer === node) ||
        (ts.isCallExpression(parent) &&
          parent.arguments.some((arg) => arg === node)) ||
        (ts.isBinaryExpression(parent) && parent.right === node) ||
        (ts.isVariableDeclaration(parent) && parent.initializer === node);

      if (usedAsValue) {
        add(node.text, "identifier");
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return unbound;
}

/**
 * After sanitize: every PascalCase JSX/component usage must resolve to an
 * import or a same-file local binding. Catches sandbox ReferenceErrors that
 * esbuild.transform cannot see (e.g. missing Lucide icons).
 */
export function validateSandboxBindings(code: string): SandboxBindingResult {
  const sourceFile = ts.createSourceFile(
    "generated-screen.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const known = new Set<string>([
    ...collectImportBindings(sourceFile),
    ...collectLocalBindings(sourceFile),
  ]);

  const unbound = collectUnboundComponentUsages(sourceFile, known);

  if (unbound.length === 0) {
    return { valid: true, issues: [], unbound: [] };
  }

  const issues = unbound.map(
    (item) =>
      `Unbound ${item.kind} "${item.name}" — not imported or defined in this single-file sandbox screen`,
  );

  return { valid: false, issues, unbound };
}
