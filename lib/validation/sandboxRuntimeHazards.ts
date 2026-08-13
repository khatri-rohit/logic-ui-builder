import * as ts from "typescript";

export interface SandboxRuntimeHazardResult {
  valid: boolean;
  issues: string[];
}

const ARRAY_CALLBACK_METHODS = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "sort",
]);

function collectLucideLocals(sourceFile: ts.SourceFile): Set<string> {
  const locals = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const mod = statement.moduleSpecifier;
    if (!ts.isStringLiteral(mod) || mod.text !== "lucide-react") continue;

    const clause = statement.importClause;
    if (!clause) continue;

    if (clause.name) locals.add(clause.name.text);

    const named = clause.namedBindings;
    if (!named) continue;

    if (ts.isNamespaceImport(named)) {
      locals.add(named.name.text);
      continue;
    }

    for (const element of named.elements) {
      locals.add(element.name.text);
    }
  }

  return locals;
}

/**
 * Catches runtime crashes that compile still accepts, e.g. .filter(Circle)
 * or `new Map()` after Map was imported from lucide-react.
 */
export function validateSandboxRuntimeHazards(
  code: string,
): SandboxRuntimeHazardResult {
  const sourceFile = ts.createSourceFile(
    "generated-screen.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const lucideLocals = collectLucideLocals(sourceFile);
  if (lucideLocals.size === 0) {
    return { valid: true, issues: [] };
  }

  const issues: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const callback = node.arguments[0];
      if (
        ARRAY_CALLBACK_METHODS.has(method) &&
        callback &&
        ts.isIdentifier(callback) &&
        lucideLocals.has(callback.text)
      ) {
        issues.push(
          `Lucide icon "${callback.text}" cannot be used as Array.${method} callback`,
        );
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      lucideLocals.has(node.expression.text)
    ) {
      issues.push(
        `"${node.expression.text}" is a Lucide icon and cannot be constructed with new`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    valid: issues.length === 0,
    issues,
  };
}
