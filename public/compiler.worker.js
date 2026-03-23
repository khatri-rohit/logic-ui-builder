importScripts("https://unpkg.com/@babel/standalone/babel.min.js");

self.onmessage = function ({ data: { screenName, code } }) {
  try {
    const cleaned = code
      .replace(/^```(?:tsx?|typescript|jsx?)?\n?/gm, "")
      .replace(/^```$/gm, "")
      .trim();

    // Babel.transform — same API shape as sucrase
    const { code: js } = Babel.transform(cleaned, {
      presets: [
        ["react", { runtime: "classic" }],
        ["typescript", { allExtensions: true, isTSX: true }],
      ],
      filename: `${screenName}.tsx`,
    });

    self.postMessage({
      screenName,
      html: buildHTML(screenName, js),
      error: null,
    });
  } catch (err) {
    self.postMessage({
      screenName,
      html: buildErrorHTML(screenName, err.message),
      error: err.message,
    });
  }
};

function buildHTML(screenName, js) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#111; color:#fff; font-family: system-ui, sans-serif; overflow:hidden; }
  #root { width:100vw; height:100vh; }
  #error { padding:12px; font-size:10px; color:#ff6b6b; font-family:monospace; white-space:pre-wrap; }
</style>
<script src="https://cdn.tailwindcss.com"></script>
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
const Image = ({source, style, ...p}) => React.createElement('img', {src:source?.uri||source, style:{objectFit:'cover',...style}, ...p})
const FlatList = ({data=[], renderItem, keyExtractor, style}) =>
  React.createElement('div', {style}, data.map((item,i) =>
    React.createElement(React.Fragment, {key: keyExtractor?.(item,i) ?? i}, renderItem({item,index:i}))
  ))
const StyleSheet = { create: s => s }
const SafeAreaView = View
const TextInput = ({style, placeholder, value, onChangeText, ...p}) =>
  React.createElement('input', {style:{outline:'none',background:'transparent',...style}, placeholder, value, onChange: e => onChangeText?.(e.target.value), ...p})

try {
${js}

// Resolve generated component by safe known names.
const Component =
  (typeof GeneratedScreen !== 'undefined' && GeneratedScreen) ||
  (typeof Screen !== 'undefined' && Screen) ||
  (() => React.createElement(View, {style:{padding:16}}, React.createElement(Text, null, '${screenName}')))

ReactDOM.render(React.createElement(Component), document.getElementById('root'))
} catch(e) {
  document.getElementById('root').innerHTML = '<div id="error">Runtime error:\\n' + e.message + '</div>'
}
</script>
</body>
</html>`;
}

function buildErrorHTML(screenName, errorMessage) {
  const escaped = errorMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head><style>
  body{margin:0;background:#1a0a0a;color:#ff6b6b;font-family:monospace;padding:12px;font-size:10px;}
  h4{color:#ff9999;margin-bottom:8px;font-size:11px;}
  pre{white-space:pre-wrap;word-break:break-word;}
</style></head>
<body>
  <h4>Compile error — ${screenName}</h4>
  <pre>${escaped}</pre>
</body>
</html>`;
}
