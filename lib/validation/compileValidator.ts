export interface CompileValidationDiagnostic {
  message: string;
  line?: number;
  col?: number;
}

export interface CompileValidationResult {
  valid: boolean;
  issues: string[];
  diagnostics: CompileValidationDiagnostic[];
}

function parseEsbuildLocation(message: string): { line?: number; col?: number } {
  // Esbuild error messages often contain line/col like:
  //   "error: Unexpected token at line 87, col 12"
  //   <stdin>:87:12: error: Unexpected token
  const lineColMatch = message.match(/[:\s](\d+):(\d+)(?::\s|$)/);
  if (lineColMatch) {
    return { line: parseInt(lineColMatch[1], 10), col: parseInt(lineColMatch[2], 10) };
  }
  const atLineMatch = message.match(/line\s+(\d+)[,\s]+col\s+(\d+)/i);
  if (atLineMatch) {
    return { line: parseInt(atLineMatch[1], 10), col: parseInt(atLineMatch[2], 10) };
  }
  return {};
}

export async function validateCompile(code: string): Promise<CompileValidationResult> {
  try {
    const esbuild = await import("esbuild");
    esbuild.transformSync(code, {
      loader: "tsx",
      jsx: "transform",
      define: { "process.env.NODE_ENV": '"production"' },
      target: "es2020",
      format: "cjs",
    });
    return { valid: true, issues: [], diagnostics: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { line, col } = parseEsbuildLocation(message);
    const diagnostic: CompileValidationDiagnostic = line
      ? { message, line, col }
      : { message };
    return { valid: false, issues: [message], diagnostics: [diagnostic] };
  }
}
