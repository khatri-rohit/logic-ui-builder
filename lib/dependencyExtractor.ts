import {
  SANDBOX_CORE_DEPENDENCIES,
  SANDBOX_PACKAGE_VERSIONS,
} from "@/lib/sandboxPackages";

const CACHE = new Map<string, ExtractedDeps>();
const MAX_CACHE_SIZE = 200;

export interface ExtractedDeps {
  dependencies: Record<string, string>;
  unknownPackages: string[];
}

export function extractDependencies(code: string): ExtractedDeps {
  const cached = CACHE.get(code);
  if (cached) return cached;

  const dependencies: Record<string, string> = {
    ...SANDBOX_CORE_DEPENDENCIES,
  };
  const unknownPackages: string[] = [];
  const seen = new Set<string>(Object.keys(dependencies));

  const importRegex =
    /(?:import\s+(?:type\s+)?(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1] ?? match[2];
    if (!importPath) continue;

    if (
      importPath.startsWith(".") ||
      importPath.startsWith("/") ||
      importPath.startsWith("@/")
    ) {
      continue;
    }

    const packageName = importPath.startsWith("@")
      ? importPath.split("/").slice(0, 2).join("/")
      : importPath.split("/")[0];

    if (isNodeBuiltin(packageName) || seen.has(packageName)) continue;
    seen.add(packageName);

    if (SANDBOX_PACKAGE_VERSIONS[packageName]) {
      dependencies[packageName] = SANDBOX_PACKAGE_VERSIONS[packageName];
    } else {
      unknownPackages.push(packageName);
    }
  }

  if (unknownPackages.length > 0) {
    console.info(
      "[deps] Unsupported generated packages skipped:",
      unknownPackages,
    );
  }

  const result: ExtractedDeps = { dependencies, unknownPackages };

  if (CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(code, result);

  return result;
}

function isNodeBuiltin(name: string): boolean {
  return new Set([
    "path",
    "fs",
    "http",
    "https",
    "os",
    "crypto",
    "stream",
    "util",
    "events",
    "buffer",
  ]).has(name);
}
