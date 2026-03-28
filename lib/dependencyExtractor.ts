// lib/dependencyExtractor.ts

// Known package versions — curated list of what LLMs commonly generate
const KNOWN_VERSIONS: Record<string, string> = {
  // Charts
  recharts: "^2.10.0",
  "chart.js": "^4.4.0",
  "react-chartjs-2": "^5.2.0",
  d3: "^7.9.0",

  // UI
  "lucide-react": "^0.400.0",
  "@heroicons/react": "^2.1.0",
  "react-icons": "^5.0.0",
  clsx: "^2.1.0",
  "class-variance-authority": "^0.7.0",
  "tailwind-merge": "^2.3.0",
  "radix-ui": "^1.4.3",
  "tw-animate-css": "^1.4.0",

  // Dates
  "date-fns": "^3.6.0",
  dayjs: "^1.11.0",

  // State
  zustand: "^4.5.0",
  jotai: "^2.8.0",

  // Forms
  "react-hook-form": "^7.51.0",
  zod: "^3.22.0",

  // Utility
  lodash: "^4.17.21",
  uuid: "^9.0.0",
  axios: "^1.6.0",

  // Always present
  react: "19.2.4",
  "react-dom": "19.2.4",
};

export interface ExtractedDeps {
  dependencies: Record<string, string>;
  unknownPackages: string[]; // imports we couldn't resolve — log for future additions
}

export function extractDependencies(code: string): ExtractedDeps {
  const dependencies: Record<string, string> = {
    react: "19.2.4",
    "react-dom": "19.2.4",
  };
  const unknownPackages: string[] = [];

  // Match all import statements
  // Handles: import X from 'pkg', import { X } from 'pkg', import 'pkg'
  const importRegex = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];

    // Skip local imports — those are not npm dependencies
    if (
      importPath.startsWith(".") ||
      importPath.startsWith("/") ||
      importPath.startsWith("@/")
    ) {
      continue;
    }

    // Extract package name — handle scoped packages (@scope/pkg) and sub-paths (pkg/sub)
    const packageName = importPath.startsWith("@")
      ? importPath.split("/").slice(0, 2).join("/") // @scope/package
      : importPath.split("/")[0]; // package or package/sub

    // Skip built-ins
    if (isBuiltin(packageName)) continue;

    if (KNOWN_VERSIONS[packageName]) {
      dependencies[packageName] = KNOWN_VERSIONS[packageName];
    } else {
      unknownPackages.push(packageName);
      // Use 'latest' as fallback — Sandpack will fetch whatever is current
      dependencies[packageName] = "latest";
    }
  }

  if (unknownPackages.length > 0) {
    console.info("[deps] Unknown packages, using latest:", unknownPackages);
  }

  return { dependencies, unknownPackages };
}

// Node/browser built-ins that don't need npm
function isBuiltin(name: string): boolean {
  const builtins = new Set([
    "react", // already added above explicitly
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
  ]);
  return builtins.has(name);
}
