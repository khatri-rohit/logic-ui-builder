importScripts("https://unpkg.com/@babel/standalone/babel.min.js");

self.onmessage = function ({ data: { screenName, code } }) {
  try {
    const cleaned = sanitizeModelOutput(code);

    // Babel.transform — same API shape as sucrase
    const { code: js } = Babel.transform(cleaned, {
      presets: [
        ["react", { runtime: "classic" }],
        ["typescript", { allExtensions: true, isTSX: true }],
      ],
      filename: `${screenName}.tsx`,
    });

    const safeJs = sanitizeInlineScript(js);
    validateGeneratedJavaScript(safeJs);

    self.postMessage({
      screenName,
      html: buildHTML(screenName, safeJs),
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      screenName,
      html: buildErrorHTML(screenName, message),
      error: message,
    });
  }
};

function sanitizeModelOutput(raw) {
  return String(raw)
    .replace(/^```(?:tsx?|typescript|jsx?)?\n?/gm, "")
    .replace(/^```$/gm, "")
    .replace(
      /<script[^>]*src=["']https?:\/\/cdn\.tailwindcss\.com[^>]*><\/script>/gi,
      "",
    )
    .trim();
}

function validateGeneratedJavaScript(js) {
  try {
    // Parse-only validation so syntax issues surface as compile errors.
    new Function(js);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Generated JavaScript syntax error: ${message}`);
  }
}

function sanitizeInlineScript(js) {
  return String(js).replace(/<\/script/gi, "<\\/script");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeForSingleQuotedJsString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/<\/script/gi, "<\\/script");
}

function buildHTML(screenName, js) {
  const safeScreenName = escapeForSingleQuotedJsString(screenName);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { min-width:100%; width:max-content; }
  body { background:#111; color:#fff; font-family: system-ui, sans-serif; overflow:auto; }
  #root { min-width:100%; min-height:100vh; }
  #error { padding:12px; font-size:10px; color:#ff6b6b; font-family:monospace; white-space:pre-wrap; }
</style>
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>
<body>
<div id="root"></div>
<script>
// Shim View, Text etc → plain divs so RN components don't crash
const View = ({style, children, ...p}) => React.createElement('div', {style, ...p}, children)
const Text = ({style, children, ...p}) => React.createElement('span', {style:{display:'block',...style}, ...p}, children)
const ScrollView = ({style, children, ...p}) => React.createElement('div', {style:{overflowY:'auto',...style}, ...p}, children)
const TouchableOpacity = ({style, onPress, children, ...p}) => React.createElement('div', {style:{cursor:'pointer',...style}, onClick:onPress, ...p}, children)
const Image = ({source, style, ...p}) => React.createElement('img', {src:(source && source.uri) || source, style:{objectFit:'cover',...style}, ...p})
const FlatList = ({data=[], renderItem, keyExtractor, style}) =>
  React.createElement('div', {style}, data.map((item,i) =>
    React.createElement(React.Fragment, {key: keyExtractor ? keyExtractor(item,i) : i}, renderItem({item,index:i}))
  ))
const StyleSheet = { create: s => s }
const SafeAreaView = View
const TextInput = ({style, placeholder, value, onChangeText, ...p}) =>
  React.createElement('input', {style:{outline:'none',background:'transparent',...style}, placeholder, value, onChange: e => onChangeText && onChangeText(e.target.value), ...p})

try {
${js}

// Resolve generated component by safe known names.
const Component =
  (typeof GeneratedScreen !== 'undefined' && GeneratedScreen) ||
  (typeof Screen !== 'undefined' && Screen) ||
  (() => React.createElement(View, {style:{padding:16}}, React.createElement(Text, null, '${safeScreenName}')))

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing root element')

if (ReactDOM.createRoot) {
  ReactDOM.createRoot(rootEl).render(React.createElement(Component))
} else {
  ReactDOM.render(React.createElement(Component), rootEl)
}
} catch(e) {
  document.getElementById('root').innerHTML = '<div id="error">Runtime error:\\n' + e.message + '</div>'
}
// Dimension reporter — runs after React renders
(function() {
  let rafId = 0
  let lastW = 0
  let lastH = 0
  let debounceTimer = 0
  let burstCount = 0
  let burstResetTimer = 0
  const MAX_BURST = 4
  const DEBOUNCE_MS = 100
  const BURST_IDLE_MS = 1500

  function scheduleReport() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      reportSize()
    })
  }

  function scheduleSettleReport() {
    if (burstCount >= MAX_BURST) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (burstCount >= MAX_BURST) return
      burstCount += 1
      scheduleReport()
      clearTimeout(burstResetTimer)
      burstResetTimer = setTimeout(() => {
        burstCount = 0
      }, BURST_IDLE_MS)
    }, DEBOUNCE_MS)
  }

  function reportSize() {
    const body = document.body
    const root = document.getElementById('root')
    const rootRect = root ? root.getBoundingClientRect() : { width: 0, height: 0 }

    // Content-rooted only — exclude html.clientHeight/offsetHeight viewport coupling.
    const width = Math.max(
      root ? root.scrollWidth : 0,
      body ? body.scrollWidth : 0,
      Math.ceil(rootRect.width)
    )

    const height = Math.max(
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      Math.ceil(rootRect.height)
    )

    if (!width || !height) return
    if (Math.abs(width - lastW) < 4 && Math.abs(height - lastH) < 4) return

    lastW = width
    lastH = height

    window.parent.postMessage({
      type: 'iframe-resize',
      screenName: '${safeScreenName}',
      width,
      height,
    }, '*')
  }

  // Report after first paint
  if (document.readyState === 'complete') {
    scheduleReport()
  } else {
    window.addEventListener('load', scheduleReport)
  }

  // Follow-up reports for async content.
  setTimeout(scheduleReport, 0)
  setTimeout(scheduleReport, 150)
  setTimeout(scheduleReport, 800)
  setTimeout(scheduleReport, 1400)

  const ro = new ResizeObserver(scheduleSettleReport)
  const root = document.getElementById('root')
  if (root) ro.observe(root)
  else ro.observe(document.body)

  const mo = new MutationObserver(scheduleSettleReport)
  mo.observe(root || document.body, { childList: true, subtree: true, attributes: false, characterData: false })
})()
</script>
</body>
</html>`;
}

function buildErrorHTML(screenName, errorMessage) {
  const escaped = escapeHtml(errorMessage);
  const escapedScreenName = escapeHtml(screenName);
  return `<!DOCTYPE html>
<html>
<head><style>
  body{margin:0;background:#1a0a0a;color:#ff6b6b;font-family:monospace;padding:12px;font-size:10px;}
  h4{color:#ff9999;margin-bottom:8px;font-size:11px;}
  pre{white-space:pre-wrap;word-break:break-word;}
</style></head>
<body>
  <h4>Compile error - ${escapedScreenName}</h4>
  <pre>${escaped}</pre>
</body>
</html>`;
}
