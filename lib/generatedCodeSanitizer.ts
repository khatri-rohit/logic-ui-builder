import * as ts from "typescript";

export const ALLOWED_IMPORT_PACKAGES = new Set([
  "react",
  "react-dom",
  "recharts",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "date-fns",
  "dayjs",
  "lodash",
]);

const CODE_START_RE =
  /^\s*(import|export|const\s+GeneratedScreen|function\s+GeneratedScreen|type\s+|interface\s+|class\s+)/;

const LOCAL_IMPORT_RE =
  /^\s*import\s+(?:[^'"]*\s+from\s+)?['"](\.\/|\.\.\/|\/|@\/)[^'"]+['"]\s*;?\s*$/;

const GENERATED_SCREEN_DEFINITION_RE =
  /(?:\b(?:export\s+default\s+)?function\s+GeneratedScreen\b|\b(?:export\s+default\s+)?class\s+GeneratedScreen\b|\b(?:export\s+)?(?:const|let|var)\s+GeneratedScreen\b)/;

const DEFAULT_EXPORT_RE = /^\s*export\s+default\b/m;
const GENERATED_DEFAULT_EXPORT_RE =
  /^\s*export\s+default\s+GeneratedScreen\s*;?\s*$/m;

const JSX_TAG_FALLBACKS: Record<string, string> = {
  Accordion: "div",
  AccordionContent: "div",
  AccordionItem: "section",
  AccordionTrigger: "button",
  Alert: "section",
  AlertDescription: "p",
  AlertDialog: "div",
  AlertDialogAction: "button",
  AlertDialogCancel: "button",
  AlertDialogContent: "section",
  AlertDialogDescription: "p",
  AlertDialogFooter: "div",
  AlertDialogHeader: "div",
  AlertDialogTitle: "h2",
  AlertTitle: "h3",
  Avatar: "div",
  AvatarFallback: "span",
  AvatarImage: "img",
  Badge: "span",
  Button: "button",
  Card: "section",
  CardContent: "div",
  CardDescription: "p",
  CardFooter: "div",
  CardHeader: "div",
  CardTitle: "h3",
  Checkbox: "input",
  Dialog: "div",
  DialogClose: "button",
  DialogContent: "section",
  DialogDescription: "p",
  DialogFooter: "div",
  DialogHeader: "div",
  DialogTitle: "h2",
  DialogTrigger: "button",
  DropdownMenu: "div",
  DropdownMenuContent: "div",
  DropdownMenuItem: "button",
  DropdownMenuLabel: "div",
  DropdownMenuSeparator: "hr",
  DropdownMenuTrigger: "button",
  Form: "form",
  FormControl: "div",
  FormDescription: "p",
  FormField: "div",
  FormItem: "div",
  FormLabel: "label",
  FormMessage: "p",
  Input: "input",
  Label: "label",
  Popover: "div",
  PopoverContent: "div",
  PopoverTrigger: "button",
  Progress: "div",
  RadioGroup: "div",
  RadioGroupItem: "input",
  ScrollArea: "div",
  Select: "div",
  SelectContent: "div",
  SelectItem: "div",
  SelectTrigger: "button",
  SelectValue: "span",
  Separator: "hr",
  Sheet: "div",
  SheetClose: "button",
  SheetContent: "section",
  SheetDescription: "p",
  SheetFooter: "div",
  SheetHeader: "div",
  SheetTitle: "h2",
  SheetTrigger: "button",
  Switch: "button",
  Table: "table",
  TableBody: "tbody",
  TableCaption: "caption",
  TableCell: "td",
  TableHead: "th",
  TableHeader: "thead",
  TableRow: "tr",
  Tabs: "div",
  TabsContent: "section",
  TabsList: "div",
  TabsTrigger: "button",
  Textarea: "textarea",
  Tooltip: "span",
  TooltipContent: "span",
  TooltipProvider: "span",
  TooltipTrigger: "span",
};

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

function getImportBindings(statement: ts.ImportDeclaration): string[] {
  const importClause = statement.importClause;
  if (!importClause) return [];

  const bindings: string[] = [];
  if (importClause.name) bindings.push(importClause.name.text);

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) return bindings;

  if (ts.isNamespaceImport(namedBindings)) {
    bindings.push(namedBindings.name.text);
    return bindings;
  }

  for (const element of namedBindings.elements) {
    bindings.push(element.name.text);
  }

  return bindings;
}

function findReferences(
  sourceFile: ts.SourceFile,
  removedBindings: Set<string>,
): { jsx: Set<string>; nonJsx: Set<string> } {
  const jsx = new Set<string>();
  const nonJsx = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;

    if (
      (ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      removedBindings.has(node.tagName.text)
    ) {
      jsx.add(node.tagName.text);
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isIdentifier(node) && removedBindings.has(node.text)) {
      nonJsx.add(node.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { jsx, nonJsx };
}

function replaceJsxTags(text: string, tagNames: Iterable<string>): string {
  let next = text;

  for (const tagName of tagNames) {
    const fallback =
      JSX_TAG_FALLBACKS[tagName] ??
      (/Icon$/.test(tagName) || /Logo$/.test(tagName) ? "span" : null);

    if (!fallback) continue;

    next = next
      .replace(new RegExp(`<${tagName}(\\s|>|/)`, "g"), `<${fallback}$1`)
      .replace(new RegExp(`</${tagName}>`, "g"), `</${fallback}>`);
  }

  return next;
}

function removeStatements(text: string, statements: ts.ImportDeclaration[]) {
  let next = text;
  const sorted = [...statements].sort((a, b) => b.getFullStart() - a.getFullStart());

  for (const statement of sorted) {
    next =
      next.slice(0, statement.getFullStart()) + next.slice(statement.getEnd());
  }

  return next;
}

function sanitizeImports(text: string): string {
  let workingText = text;

  for (let pass = 0; pass < 2; pass++) {
    const sourceFile = ts.createSourceFile(
      "generated-screen.tsx",
      workingText,
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
      for (const binding of getImportBindings(statement)) {
        removedBindings.add(binding);
      }
    }

    if (forbiddenImports.length === 0) return workingText;

    const references = findReferences(sourceFile, removedBindings);
    const unsupportedNonJsxReferences = [...references.nonJsx].filter(
      (binding) => !references.jsx.has(binding),
    );

    if (unsupportedNonJsxReferences.length > 0) {
      return "";
    }

    const unsupportedJsxReferences = [...references.jsx].filter(
      (binding) =>
        !JSX_TAG_FALLBACKS[binding] &&
        !/Icon$/.test(binding) &&
        !/Logo$/.test(binding),
    );

    if (unsupportedJsxReferences.length > 0) {
      return "";
    }

    workingText = replaceJsxTags(workingText, references.jsx);
    workingText = removeStatements(workingText, forbiddenImports);
  }

  return workingText;
}

function stripAnimationTokens(text: string): string {
  return text
    .replace(/\bframer-motion\b/g, "")
    .replace(/\bmotion\/react\b/g, "")
    .replace(/\bmotion\.(\w+)\b/g, "$1")
    .replace(
      /\b(?:animate-(?:spin|bounce|ping|pulse|wiggle|in|out)|(?:fade|zoom)-in(?:-\d+)?|(?:fade|zoom)-out(?:-\d+)?|slide-(?:in|out)-from-(?:top|bottom|left|right)(?:-\d+)?)\b/g,
      "",
    )
    .replace(
      /\bdata-\[[^\]]+\]:(?:animate-(?:in|out)|fade-in(?:-\d+)?|zoom-in(?:-\d+)?|slide-in-from-(?:top|bottom|left|right)(?:-\d+)?)\b/g,
      "",
    )
    .replace(/[ \t]{2,}/g, " ");
}

function stripExistingGeneratedDefaultExport(text: string): string {
  return text.replace(GENERATED_DEFAULT_EXPORT_RE, "").trim();
}

function normalizeWrongDefaultExport(text: string): string {
  let next = text.trim();

  const defaultFunctionMatch = next.match(
    /^\s*export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/m,
  );
  if (defaultFunctionMatch) {
    next = next.replace(
      /^\s*export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/m,
      "function GeneratedScreen(",
    );
    return `${stripExistingGeneratedDefaultExport(next)}\n\nexport default GeneratedScreen;`;
  }

  const defaultClassMatch = next.match(
    /^\s*export\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/m,
  );
  if (defaultClassMatch) {
    next = next.replace(
      /^\s*export\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/m,
      "class GeneratedScreen",
    );
    return `${stripExistingGeneratedDefaultExport(next)}\n\nexport default GeneratedScreen;`;
  }

  const anonymousFunctionExport = /^\s*export\s+default\s+(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/m;
  if (anonymousFunctionExport.test(next)) {
    next = next.replace(anonymousFunctionExport, "const GeneratedScreen = () =>");
    return `${stripExistingGeneratedDefaultExport(next)}\n\nexport default GeneratedScreen;`;
  }

  const defaultIdentifierMatch = next.match(
    /^\s*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/m,
  );
  if (defaultIdentifierMatch && defaultIdentifierMatch[1] !== "GeneratedScreen") {
    const exportedName = defaultIdentifierMatch[1];
    const declarationRe = new RegExp(
      `(function|class|const|let|var)\\s+${exportedName}\\b`,
    );

    if (declarationRe.test(next)) {
      next = next.replace(declarationRe, "$1 GeneratedScreen");
      next = next.replace(defaultIdentifierMatch[0], "");
      return `${stripExistingGeneratedDefaultExport(next)}\n\nexport default GeneratedScreen;`;
    }
  }

  return next;
}

function ensureDefaultExport(text: string): string {
  let next = normalizeWrongDefaultExport(text);

  if (GENERATED_DEFAULT_EXPORT_RE.test(next)) {
    next = stripExistingGeneratedDefaultExport(next);
    return `${next}\n\nexport default GeneratedScreen;\n`;
  }

  if (DEFAULT_EXPORT_RE.test(next)) {
    return next;
  }

  if (GENERATED_SCREEN_DEFINITION_RE.test(next)) {
    return `${next.trim()}\n\nexport default GeneratedScreen;\n`;
  }

  return next;
}

function fallbackStaticScreen(reason = "unsupported imports or invalid TSX"): string {
  return `import React from "react";

function GeneratedScreen() {
  return (
    <main className="w-full min-h-screen bg-slate-950 text-slate-100 p-8 lg:p-12">
      <section className="w-full max-w-6xl mx-auto border border-slate-800 rounded-2xl bg-slate-900/70 p-6 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Generation needs repair</p>
        <h1 className="mt-3 text-2xl lg:text-4xl font-semibold tracking-tight">Design Preview</h1>
        <p className="mt-3 text-slate-300 leading-relaxed">
          The model output could not be made runnable because it contained ${reason}. Regenerate this frame to request a clean TSX version.
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
