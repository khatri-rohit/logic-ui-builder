import * as ts from "typescript";

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateGeneratedTSX(code: string): ValidationResult {
  const issues: string[] = [];

  // Fast structural checks
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push("Unbalanced braces");
  }

  if (!code.includes("export default GeneratedScreen")) {
    issues.push("Missing default export");
  }

  // TS parser check — only syntax errors, not semantic/type errors
  const sourceFile = ts.createSourceFile(
    "generated.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  const parseErrors =
    parseDiagnostics?.filter(
      (d: ts.Diagnostic) => d.category === ts.DiagnosticCategory.Error,
    ) ?? [];

  if (parseErrors.length > 0) {
    issues.push(
      ...parseErrors.map((d: ts.Diagnostic) =>
        ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      ),
    );
  }

  return { valid: issues.length === 0, issues };
}
