import {
  ALLOWED_LUCIDE_ICON_SET,
  LUCIDE_FALLBACK_ICON,
} from "@/lib/lucideAllowlist";
import { buildSandboxFallbackScreen } from "@/lib/sandboxFallbackScreen";
import {
  lucideImportSpecifier,
  lucideRenderName,
  SANDBOX_LANGUAGE_GLOBALS,
} from "@/lib/sandboxLanguageGlobals";
import { ALLOWED_SANDBOX_PACKAGES } from "@/lib/sandboxPackages";
import * as ts from "typescript";

export const ALLOWED_IMPORT_PACKAGES = ALLOWED_SANDBOX_PACKAGES;


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

function isPascalCaseName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function collectLocalNames(sourceFile: ts.SourceFile): Set<string> {
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

function isInsideImport(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isImportDeclaration(current)) return true;
    current = current.parent;
  }
  return false;
}

function isTypePosition(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      ts.isTypeNode(current) ||
      ts.isTypeAliasDeclaration(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeParameterDeclaration(current)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isPropertyNamePosition(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isJsxAttribute(parent) && parent.name === node) return true;
  return false;
}

function isElementFactoryCall(node: ts.CallExpression): boolean {
  const expr = node.expression;
  if (ts.isIdentifier(expr)) {
    return expr.text === "createElement" || expr.text === "cloneElement";
  }
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return (
      expr.name.text === "createElement" || expr.name.text === "cloneElement"
    );
  }
  return false;
}

function isIconUsageIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (
    (ts.isJsxOpeningElement(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxClosingElement(parent)) &&
    parent.tagName === node
  ) {
    return true;
  }

  if (ts.isJsxExpression(parent) && parent.expression === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) return true;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return true;
  }
  if (
    ts.isCallExpression(parent) &&
    isElementFactoryCall(parent) &&
    parent.arguments.some((arg) => arg === node)
  ) {
    return true;
  }

  return false;
}

function collectLucideImportPairs(
  sourceFile: ts.SourceFile,
): Map<string, string> {
  const pairs = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const mod = statement.moduleSpecifier;
    if (!ts.isStringLiteral(mod) || mod.text !== "lucide-react") continue;

    const clause = statement.importClause;
    if (!clause) continue;

    const named = clause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;

    for (const element of named.elements) {
      const local = element.name.text;
      const exported = element.propertyName?.text ?? element.name.text;
      pairs.set(local, exported);
    }
  }

  return pairs;
}

function collectComponentUsages(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      isPascalCaseName(node.tagName.text)
    ) {
      names.add(node.tagName.text);
    }

    if (ts.isIdentifier(node) && isPascalCaseName(node.text)) {
      const parent = node.parent;
      const usedAsIconValue =
        isIconUsageIdentifier(node) ||
        (ts.isBinaryExpression(parent) && parent.right === node);

      if (usedAsIconValue) {
        names.add(node.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return names;
}

function rewriteIdentifiers(
  text: string,
  replacements: Map<string, string>,
  mode: "all-values" | "icon-usages",
): string {
  if (replacements.size === 0) return text;

  const sourceFile = ts.createSourceFile(
    "generated-screen.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const edits: { start: number; end: number; to: string }[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const to = replacements.get(node.text);
      if (to && to !== node.text) {
        const rewrite =
          mode === "icon-usages"
            ? isIconUsageIdentifier(node)
            : !isInsideImport(node) &&
              !isPropertyNamePosition(node) &&
              !isTypePosition(node);

        if (rewrite) {
          edits.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            to,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  edits.sort((a, b) => b.start - a.start);

  let next = text;
  for (const edit of edits) {
    next = next.slice(0, edit.start) + edit.to + next.slice(edit.end);
  }
  return next;
}

function isLanguageBuiltinOnly(name: string): boolean {
  return (
    SANDBOX_LANGUAGE_GLOBALS.has(name) && !ALLOWED_LUCIDE_ICON_SET.has(name)
  );
}

/**
 * Usage-based Lucide reconciliation for single-file sandbox:
 * - allowlisted icons used in JSX/value → ensure imported
 * - unknown / invented icons → rewrite all refs to Circle and import Circle
 * - rebuild one clean lucide-react import from the final set
 */
function reconcileLucideUsage(text: string): string {
  const sourceFile = ts.createSourceFile(
    "generated-screen.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const locals = collectLocalNames(sourceFile);
  const usages = collectComponentUsages(sourceFile);
  const lucideLocalToExported = collectLucideImportPairs(sourceFile);

  const fallbackRewrites = new Map<string, string>();
  const aliasRewrites = new Map<string, string>();
  const neededIcons = new Set<string>();

  const importedFromOtherPackage = (name: string): boolean =>
    sourceFile.statements.some((statement) => {
      if (!ts.isImportDeclaration(statement)) return false;
      const mod = statement.moduleSpecifier;
      if (!ts.isStringLiteral(mod) || mod.text === "lucide-react") return false;
      return getImportBindings(statement).includes(name);
    });

  const trackAllowlistedIcon = (icon: string, localName?: string) => {
    neededIcons.add(icon);
    const render = lucideRenderName(icon);
    if (localName && localName !== render) {
      aliasRewrites.set(localName, render);
    }
    if (icon !== render) {
      aliasRewrites.set(icon, render);
    }
  };

  for (const [local, exported] of lucideLocalToExported) {
    if (ALLOWED_LUCIDE_ICON_SET.has(exported)) {
      trackAllowlistedIcon(exported, local);
      continue;
    }
    if (isLanguageBuiltinOnly(local) || isLanguageBuiltinOnly(exported)) {
      continue;
    }
    fallbackRewrites.set(local, LUCIDE_FALLBACK_ICON);
    neededIcons.add(LUCIDE_FALLBACK_ICON);
  }

  for (const name of usages) {
    if (locals.has(name)) continue;
    if (JSX_TAG_FALLBACKS[name]) continue;
    if (importedFromOtherPackage(name)) continue;
    if (isLanguageBuiltinOnly(name)) continue;

    const exported = lucideLocalToExported.get(name) ?? name;

    if (ALLOWED_LUCIDE_ICON_SET.has(name)) {
      trackAllowlistedIcon(name, name);
      continue;
    }
    if (ALLOWED_LUCIDE_ICON_SET.has(exported)) {
      trackAllowlistedIcon(exported, name);
      continue;
    }

    fallbackRewrites.set(name, LUCIDE_FALLBACK_ICON);
    neededIcons.add(LUCIDE_FALLBACK_ICON);
  }

  let next = rewriteIdentifiers(text, fallbackRewrites, "all-values");
  next = rewriteIdentifiers(next, aliasRewrites, "icon-usages");

  const afterParse = ts.createSourceFile(
    "generated-screen.tsx",
    next,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const lucideDecls: ts.ImportDeclaration[] = [];
  for (const statement of afterParse.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const mod = statement.moduleSpecifier;
    if (ts.isStringLiteral(mod) && mod.text === "lucide-react") {
      lucideDecls.push(statement);
    }
  }

  for (const decl of [...lucideDecls].sort(
    (a, b) => b.getFullStart() - a.getFullStart(),
  )) {
    next = next.slice(0, decl.getFullStart()) + next.slice(decl.getEnd());
  }

  next = next.replace(/^\s*\n/, "");

  if (neededIcons.size > 0) {
    const icons = [...neededIcons].sort((a, b) => a.localeCompare(b));
    const specifiers = icons.map(lucideImportSpecifier).join(", ");
    const importLine = `import { ${specifiers} } from "lucide-react";\n`;

    const reactImportMatch = next.match(
      /^\s*import\s+[\s\S]*?from\s+["']react["'];?\s*\n?/,
    );
    if (reactImportMatch && reactImportMatch.index !== undefined) {
      const insertAt = reactImportMatch.index + reactImportMatch[0].length;
      next = next.slice(0, insertAt) + importLine + next.slice(insertAt);
    } else {
      next = `${importLine}${next}`;
    }
  }

  return next;
}

function sanitizeImports(text: string): string {
  let workingText = reconcileLucideUsage(text);

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
    return buildSandboxFallbackScreen();
  }

  return `${next}\n`;
}
