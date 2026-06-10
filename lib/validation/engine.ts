import * as ts from "typescript";

export interface ValidationDiagnostic {
  message: string;
  line?: number;
  col?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  diagnostics: ValidationDiagnostic[];
}

export function validateGeneratedTSX(code: string): ValidationResult {
  const issues: string[] = [];
  const diagnostics: ValidationDiagnostic[] = [];

  if (!/export\s+default/.test(code)) {
    issues.push("Missing default export");
    diagnostics.push({ message: "Missing default export" });
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
    for (const d of parseErrors) {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      issues.push(message);
      if (typeof d.start === "number") {
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, d.start);
        diagnostics.push({ message, line: line + 1, col: character + 1 });
      } else {
        diagnostics.push({ message });
      }
    }
  }

  return { valid: issues.length === 0, issues, diagnostics };
}
