import { extractDependencies } from "./dependencyExtractor";
import { sanitizeGeneratedCode } from "./generatedCodeSanitizer";

export const SANDBOX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { 
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    body { min-height: 100vh; }
    #root { width: 100%; min-height: 100vh; }
    
    /* Design system tokens available as CSS vars for generated components */
    :root {
      --font-sans: 'Inter', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
      --shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
      --shadow-xl: 0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04);
    }
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

  const postToParent = (payload) => {
    window.parent.postMessage(payload, '*')
  }

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

    postToParent({
      type: 'frame-dimensions',
      width,
      height,
    })
  }

  window.addEventListener('contextmenu', (event) => {
    postToParent({
      type: 'frame-context-menu',
      clientX: event.clientX,
      clientY: event.clientY,
    })
    event.preventDefault()
  }, { capture: true })

  window.addEventListener('pointerdown', (event) => {
    if (event.button === 2) return

    postToParent({
      type: 'frame-pointer-down',
    })
  }, { capture: true })

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
