/** Single source of truth for packages the Sandpack preview can actually resolve. */
export const SANDBOX_PACKAGE_VERSIONS: Record<string, string> = {
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

export const ALLOWED_SANDBOX_PACKAGES = new Set(
  Object.keys(SANDBOX_PACKAGE_VERSIONS),
);

/** Always present in every frame so Lucide imports cannot race the bundler. */
export const SANDBOX_CORE_DEPENDENCIES: Record<string, string> = {
  react: SANDBOX_PACKAGE_VERSIONS.react,
  "react-dom": SANDBOX_PACKAGE_VERSIONS["react-dom"],
  "lucide-react": SANDBOX_PACKAGE_VERSIONS["lucide-react"],
};
