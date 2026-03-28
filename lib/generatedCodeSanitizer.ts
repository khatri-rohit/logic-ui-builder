import * as ts from "typescript";

const ALLOWED_IMPORT_PACKAGES = new Set([
  "react",
  "react-dom",
  "recharts",
  "lucide-react",
  "clsx",
]);

const CODE_START_RE =
  /^\s*(import|export|const\s+GeneratedScreen|function\s+GeneratedScreen|type\s+|interface\s+|class\s+)/;

const LOCAL_IMPORT_RE =
  /^\s*import\s+(?:[^'\"]*\s+from\s+)?['\"](\.\/|\.\.\/|\/|@\/)[^'\"]+['\"]\s*;?\s*$/;

const GENERATED_SCREEN_DEFINITION_RE =
  /(?:\bfunction\s+GeneratedScreen\b|\bclass\s+GeneratedScreen\b|\b(?:const|let|var)\s+GeneratedScreen\b)/;

const DEFAULT_EXPORT_RE = /^\s*export\s+default\b/m;

function basePackageFromImport(path: string): string {
  if (path.startsWith("@")) {
    return path.split("/").slice(0, 2).join("/");
  }
  return path.split("/")[0];
}

function stripLeadingNonCode(text: string): string {
  const lines = text.split("\n");
  const firstCodeLine = lines.findIndex((line) => CODE_START_RE.test(line));
  if (firstCodeLine <= 0) return text;
  return lines.slice(firstCodeLine).join("\n");
}

function sanitizeImports(text: string): string {
  const sourceFile = ts.createSourceFile(
    "generated-screen.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const forbiddenImports: ts.ImportDeclaration[] = [];
  const removedBindings = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const moduleSpecifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) continue;

    const importPath = moduleSpecifier.text;
    const importText = statement.getText(sourceFile);

    const isLocalImport = LOCAL_IMPORT_RE.test(importText);
    const pkg = basePackageFromImport(importPath);
    const isAllowedPackage = ALLOWED_IMPORT_PACKAGES.has(pkg);

    if (!isLocalImport && isAllowedPackage) continue;

    forbiddenImports.push(statement);

    const importClause = statement.importClause;
    if (!importClause) continue;

    if (importClause.name) {
      removedBindings.add(importClause.name.text);
    }

    const namedBindings = importClause.namedBindings;
    if (!namedBindings) continue;

    if (ts.isNamespaceImport(namedBindings)) {
      removedBindings.add(namedBindings.name.text);
      continue;
    }

    for (const element of namedBindings.elements) {
      removedBindings.add(element.name.text);
    }
  }

  if (forbiddenImports.length === 0) return text;

  let referencesRemovedBindings = false;

  const visit = (node: ts.Node) => {
    if (referencesRemovedBindings) return;

    if (ts.isImportDeclaration(node)) return;

    if (ts.isIdentifier(node) && removedBindings.has(node.text)) {
      referencesRemovedBindings = true;
      return;
    }

    if (
      (ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      removedBindings.has(node.tagName.text)
    ) {
      referencesRemovedBindings = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (forbiddenImports.length > 0 || referencesRemovedBindings) {
    // Conservative sentinel: avoid returning partially broken TSX after import removal.
    return "";
  }

  return text;
}

function stripAnimationTokens(text: string): string {
  return text
    .replace(/\bframer-motion\b/g, "")
    .replace(/\bmotion\/react\b/g, "")
    .replace(
      /\b(?:animate-[^\s'\"`]+|transition(?:-[^\s'\"`]+)?|duration-\d+|ease-[^\s'\"`]+|delay-\d+)\b/g,
      "",
    )
    .replace(/[ \t]{2,}/g, " ");
}

function ensureDefaultExport(text: string): string {
  if (DEFAULT_EXPORT_RE.test(text)) return text;

  if (GENERATED_SCREEN_DEFINITION_RE.test(text)) {
    return `${text.trim()}\n\nexport default GeneratedScreen;\n`;
  }

  return text;
}

function fallbackStaticScreen(): string {
  return `import React from "react";

function GeneratedScreen() {
  return (
    <main className="w-full min-h-screen bg-slate-950 text-slate-100 p-8 lg:p-12">
      <section className="w-full max-w-6xl mx-auto border border-slate-800 rounded-2xl bg-slate-900/70 p-6 lg:p-8">
        <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight">Design Preview</h1>
        <p className="mt-3 text-slate-300 leading-relaxed">
          The previous model output was sanitized because it included unsupported imports or invalid preface text.
        </p>
      </section>
    </main>
  );
}

export default GeneratedScreen;
`;
}

export function sanitizeGeneratedCode(raw: string): string {
  let next = raw
    .replace(/^```(?:tsx?|typescript|jsx?)?\n?/gm, "")
    .replace(/^```$/gm, "")
    .replace(/^\uFEFF/, "")
    .trim();

  next = stripLeadingNonCode(next);
  next = sanitizeImports(next);
  next = stripAnimationTokens(next);
  next = ensureDefaultExport(next).trim();

  const hasGeneratedScreen =
    GENERATED_SCREEN_DEFINITION_RE.test(next) && DEFAULT_EXPORT_RE.test(next);

  if (!hasGeneratedScreen || next.length < 40) {
    return fallbackStaticScreen();
  }

  return `${next}\n`;
}
