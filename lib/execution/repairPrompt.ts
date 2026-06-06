import { ValidationDiagnostic } from "@/lib/validation/engine";
import { CompileValidationDiagnostic } from "@/lib/validation/compileValidator";

export interface RepairDiagnostics {
  tsDiagnostics: ValidationDiagnostic[];
  compileDiagnostics: CompileValidationDiagnostic[];
}

export function buildRepairPrompt(
  brokenCode: string,
  diagnostics: RepairDiagnostics,
  originalSystem: string,
  originalPrompt: string,
): { system: string; prompt: string } {
  const allErrors: string[] = [];

  for (const d of diagnostics.tsDiagnostics) {
    const location = d.line ? ` (line ${d.line}${d.col ? `, col ${d.col}` : ""})` : "";
    allErrors.push(`- ${d.message}${location}`);
  }

  for (const d of diagnostics.compileDiagnostics) {
    const location = d.line ? ` (line ${d.line}${d.col ? `, col ${d.col}` : ""})` : "";
    allErrors.push(`- ${d.message}${location}`);
  }

  const system = `${originalSystem}\n\nYou are now fixing a previously generated TSX file that has syntax or compilation errors. You must return the COMPLETE corrected file. Do not explain changes. Do not return partial snippets or diffs. Preserve all design, styling, and functionality exactly as intended, only correcting the listed errors.`;

  const prompt = `${originalPrompt}\n\n---\n\nCRITICAL: The generated code below has errors that must be fixed:\n${allErrors.join("\n")}\n\nBroken code:\n\`\`\`tsx\n${brokenCode}\n\`\`\`\n\nReturn the fully corrected TSX file. Ensure it is a complete, valid, compilable TSX file with \`export default GeneratedScreen\`.`;

  return { system, prompt };
}
