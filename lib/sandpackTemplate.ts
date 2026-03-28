import { extractDependencies } from "./dependencyExtractor";
import { sanitizeGeneratedCode } from "./generatedCodeSanitizer";

export const SANDBOX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; }
    #root { width: 100%; min-height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

export const SANDBOX_ENTRY = `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)

// Auto-dimension reporter — mounted in runtime entry so it works regardless of template internals
;(function () {
  let lastW = 0
  let lastH = 0

  const report = () => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    const rootRect = root ? root.getBoundingClientRect() : { width: 0, height: 0 }

    const width = Math.max(
      html.scrollWidth,
      html.offsetWidth,
      html.clientWidth,
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0,
      Math.ceil(rootRect.width)
    )

    const height = Math.max(
      html.scrollHeight,
      html.offsetHeight,
      html.clientHeight,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      Math.ceil(rootRect.height)
    )

    if (Math.abs(width - lastW) < 4 && Math.abs(height - lastH) < 4) return

    lastW = width
    lastH = height

    window.parent.postMessage(
      {
        type: 'frame-dimensions',
        width,
        height,
      },
      '*'
    )
  }

  window.addEventListener('load', () => {
    setTimeout(report, 80)
    setTimeout(report, 300)
    setTimeout(report, 800)
    setTimeout(report, 1400)
  })

  window.addEventListener('resize', report)

  const ro = new ResizeObserver(report)
  ro.observe(document.documentElement)

  const mo = new MutationObserver(report)
  mo.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  })
})()
`;

export function buildSandpackFiles(
  code: string,
): Record<string, { code: string }> {
  const cleaned = sanitizeGeneratedCode(code);

  // Ensure React is imported — inject if missing
  const { dependencies } = extractDependencies(cleaned);

  return {
    "/package.json": {
      code: JSON.stringify({ main: "/index.tsx", dependencies }, null, 2),
    },
    "/public/index.html": { code: SANDBOX_HTML },
    "/index.tsx": { code: SANDBOX_ENTRY },
    "/App.tsx": { code: cleaned },
  };
}
