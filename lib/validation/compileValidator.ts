export interface CompileValidationResult {
  valid: boolean;
  issues: string[];
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
    return { valid: true, issues: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, issues: [message] };
  }
}
