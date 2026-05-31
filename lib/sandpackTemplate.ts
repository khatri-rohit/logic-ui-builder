import { extractDependencies } from "./dependencyExtractor";

export const SANDBOX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="dns-prefetch" href="https://cdn.tailwindcss.com">
  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <!-- Tailwind CSS CDN with plugins -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,container-queries"></script>

  <!-- Tailwind theme configuration matching our design system -->
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            surface: 'var(--surface)',
            'surface-elevated': 'var(--surface-elevated)',
            'surface-overlay': 'var(--surface-overlay)',
            border: 'var(--border)',
            primary: 'var(--primary)',
            'primary-muted': 'var(--primary-muted)',
            accent: 'var(--accent)',
            'accent-muted': 'var(--accent-muted)',
            'text-primary': 'var(--text-primary)',
            'text-secondary': 'var(--text-secondary)',
            'text-tertiary': 'var(--text-tertiary)',
            success: 'var(--success)',
            warning: 'var(--warning)',
            error: 'var(--error)',
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
          },
          borderRadius: {
            sm: 'var(--radius-sm)',
            md: 'var(--radius-md)',
            lg: 'var(--radius-lg)',
            xl: 'var(--radius-xl)',
          },
          boxShadow: {
            sm: 'var(--shadow-sm)',
            md: 'var(--shadow-md)',
            lg: 'var(--shadow-lg)',
            xl: 'var(--shadow-xl)',
          },
        },
      },
      corePlugins: {
        preflight: true,
      },
    }
  </script>

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

    /* Light mode design system tokens (default) */
    :root {
      --font-sans: 'Inter', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, monospace;

      /* Background colors */
      --surface: #fbfbfa;
      --surface-elevated: #f4f4f2;
      --surface-overlay: #ececea;
      --border: rgba(15,15,15,0.10);

      /* Text colors */
      --text-primary: #10100e;
      --text-secondary: rgba(16,16,14,0.66);
      --text-tertiary: rgba(16,16,14,0.42);

      /* Interactive colors (populated dynamically via prompt) */
      --primary: #2563eb;
      --primary-muted: #2563eb22;
      --accent: #f59e0b;
      --accent-muted: #f59e0b22;

      /* Semantic colors */
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;

      /* Radius scale */
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;

      /* Shadow scale */
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
      --shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
      --shadow-xl: 0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04);
    }

    /* Dark mode design system tokens */
    [data-theme="dark"] {
      --surface: #0f0f0f;
      --surface-elevated: #1a1a1a;
      --surface-overlay: #242424;
      --border: rgba(255,255,255,0.10);
      --text-primary: #f2f2ef;
      --text-secondary: rgba(242,242,239,0.66);
      --text-tertiary: rgba(242,242,239,0.42);
      --primary: #3b82f6;
      --primary-muted: #3b82f622;
      --accent: #fbbf24;
      --accent-muted: #fbbf2422;
      --success: #4ade80;
      --warning: #fbbf24;
      --error: #f87171;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.30);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.20);
      --shadow-lg: 0 10px 15px rgba(0,0,0,0.30), 0 4px 6px rgba(0,0,0,0.15);
      --shadow-xl: 0 20px 25px rgba(0,0,0,0.30), 0 10px 10px rgba(0,0,0,0.15);
    }

    /* Preflight override to prevent Tailwind from wiping our CSS vars */
    :root {
      --tw-border-opacity: 1;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-color: rgb(59 130 246 / 0.5);
      --tw-ring-offset-shadow: 0 0 #0000;
      --tw-ring-shadow: 0 0 #0000;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-colored: 0 0 #0000;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

export function buildSandboxEntry(parentOrigin: string): string {
  return `
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
  const PARENT_ORIGIN = '${parentOrigin}'

  const postToParent = (payload) => {
    try {
      window.parent.postMessage(payload, PARENT_ORIGIN)
    } catch (e) {
      // If origin mismatch, silently drop — prevents cross-origin errors
    }
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
}

export function buildSandpackFiles(
  code: string,
  parentOrigin?: string,
): Record<string, { code: string }> {
  const { dependencies } = extractDependencies(code);
  const origin =
    parentOrigin || typeof window !== "undefined"
      ? window.location.origin
      : "*";

  return {
    "/package.json": {
      code: JSON.stringify({ main: "/index.tsx", dependencies }, null, 2),
    },
    "/public/index.html": {
      code: SANDBOX_HTML.replaceAll("SANDBOX_PARENT_ORIGIN", origin),
    },
    "/index.tsx": { code: buildSandboxEntry(origin) },
    "/App.tsx": { code: code },
  };
}
