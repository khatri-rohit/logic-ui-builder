const KNOWN_VERSIONS: Record<string, string> = {
  react: "19.2.4",
  "react-dom": "19.2.4",
  "lucide-react": "^0.577.0",
  recharts: "^2.10.0",
  clsx: "^2.1.1",
  "tailwind-merge": "^3.5.0",
  "date-fns": "^3.6.0",
  dayjs: "^1.11.0",
  lodash: "^4.17.21",
};

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
    react: "19.2.4",
    "react-dom": "19.2.4",
  };
  const unknownPackages: string[] = [];
  const seen = new Set<string>();

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

    if (isBuiltin(packageName) || seen.has(packageName)) continue;
    seen.add(packageName);

    if (KNOWN_VERSIONS[packageName]) {
      dependencies[packageName] = KNOWN_VERSIONS[packageName];
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

function isBuiltin(name: string): boolean {
  return new Set([
    "react",
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
