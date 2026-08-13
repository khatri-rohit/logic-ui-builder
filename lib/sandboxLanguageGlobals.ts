/**
 * PascalCase identifiers that exist in the browser/TS runtime.
 * Generated screens run as a single Sandpack file — these must never be
 * treated as missing Lucide icons or unbound components.
 */
export const SANDBOX_LANGUAGE_GLOBALS = new Set([
  "AbortController",
  "Array",
  "ArrayBuffer",
  "Audio",
  "BigInt",
  "Blob",
  "Boolean",
  "DataView",
  "Date",
  "Error",
  "Event",
  "File",
  "FileReader",
  "FormData",
  "Function",
  "Headers",
  "History",
  "Image",
  "Infinity",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "MutationObserver",
  "NaN",
  "Number",
  "Object",
  "Option",
  "Promise",
  "Proxy",
  "Reflect",
  "RegExp",
  "Request",
  "ResizeObserver",
  "Response",
  "Set",
  "String",
  "Symbol",
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "Uint8Array",
  "WeakMap",
  "WeakSet",
]);

/**
 * Lucide export names that collide with browser constructors.
 * Always import these aliased so `new Map()` / `new Image()` keep working.
 */
export const LUCIDE_JS_COLLISION_ALIASES: Record<string, string> = {
  Audio: "AudioIcon",
  File: "FileIcon",
  History: "HistoryIcon",
  Image: "ImageIcon",
  Map: "MapIcon",
  Video: "VideoIcon",
};

export function lucideRenderName(icon: string): string {
  return LUCIDE_JS_COLLISION_ALIASES[icon] ?? icon;
}

export function lucideImportSpecifier(icon: string): string {
  const alias = LUCIDE_JS_COLLISION_ALIASES[icon];
  return alias ? `${icon} as ${alias}` : icon;
}
