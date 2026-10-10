// Visual review of the real NavigationChrome through react-native-web.
// Map and SDK maneuver header are explicit fixtures, not native navigation proof.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ts = require('typescript'), React = require('react'), RN = require('react-native-web');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || 'C:/Users/farle/.codex/tmp/zippy-prototype-review/node_modules/playwright');
const root = path.resolve(__dirname, '../..'), output = process.env.QA_OUTPUT || 'C:/Users/farle/.codex/tmp/zippy-navigation-20261009';
let mode = 'dark';
function load(relative) {
  const filename = path.resolve(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  const localRequire = name => {
    if (name === 'react-native') return RN;
    if (name === 'lucide-react-native') return require('lucide-react');
    if (name === '@react-native-async-storage/async-storage') return { getItem: async () => null, setItem: async () => {} };
    if (name === './theme') { const theme = load('src/ui/theme.tsx'); return { ...theme, useZippyTheme: () => ({ colors: theme.palettes[mode] }) }; }
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts');
    return require(name);
  };
  vm.runInNewContext(compiled, { exports, require: localRequire, Date, Promise, console });
  return exports;
}
const { NavigationChrome } = load('src/ui/NavigationChrome.tsx');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const width of [360, 390]) for (mode of ['light', 'dark']) for (const status of ['guiding', 'error']) {
      const name = `${mode}-${width}-${status}`;
      const component = renderToStaticMarkup(React.createElement(NavigationChrome, {
        state: { status, seconds: 1260, meters: 9500, message: status === 'error' ? 'Ainda aguardando o GPS. Confira a localização do aparelho.' : undefined },
        address: 'Alameda dos Mandarins, 500 – Grand Ville', following: false, muted: false,
        top: 24, bottom: 16, footerInset: 174,
        onCenter() {}, onMute() {}, onExit() {}, onRetry() {}, onHeight() {},
      }));
      const colors = load('src/ui/theme.tsx').palettes[mode];
      const header = status === 'guiding' ? `<div class="sdk-fixture">↱ &nbsp; Em 250 m<br><strong>Alameda dos Mandarins</strong><br><small>DEMONSTRAÇÃO DO CABEÇALHO SDK</small></div>` : '';
      const html = `<!doctype html><meta charset="utf-8"><style>${RN.StyleSheet.getSheet().textContent}
        @font-face{font-family:ManropeMedium;src:url('${pathToFileURL(path.join(root,'assets/fonts/Manrope-Variable.ttf'))}')}@font-face{font-family:ManropeExtraBold;src:url('${pathToFileURL(path.join(root,'assets/fonts/Manrope-ExtraBold.ttf'))}')}
        html,body{margin:0;height:100%;overflow:hidden;background:${colors.paper}}.sdk-fixture{position:absolute;top:36px;left:12px;right:12px;padding:18px;border-radius:23px;background:#2872e3;color:white;font:18px ManropeMedium}.sdk-fixture strong{font:22px ManropeExtraBold}.sdk-fixture small{font-size:8px}
        .label{position:absolute;bottom:0;left:14px;color:${colors.muted};font:8px sans-serif}
        </style><div style="position:relative;height:100vh"><svg width="100%" height="100%" style="position:absolute;background:${mode==='dark'?'#263b54':'#e0e8f2'}"><defs><pattern id="grid" width="95" height="95" patternUnits="userSpaceOnUse"><path d="M0 0L95 95M95 0L0 95" stroke="${mode==='dark'?'#415b75':'#c2cddd'}" stroke-width="8"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/><path d="M200 560L160 430L270 360L230 280L120 230" fill="none" stroke="#2872e3" stroke-width="9"/><circle cx="200" cy="560" r="10" fill="#92bcff"/><circle cx="120" cy="230" r="9" fill="#306cdf"/></svg>${header}${component}<div class="label">MAPA ILUSTRATIVO · SEM GPS OU API</div></div>`;
      const htmlFile = path.join(output, name + '.html'); fs.writeFileSync(htmlFile, html);
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto(pathToFileURL(htmlFile).href); await page.evaluate(() => document.fonts.ready);
      for (const text of ['Sair', 'Voltar a acompanhar']) {
        const bounds = await page.getByText(text, { exact: true }).boundingBox();
        if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width || bounds.y + bounds.height > 844) throw new Error('Controle fora da tela: ' + text);
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow horizontal');
      if (await page.getByText(/Pedido #|Conferir pedido|Cliente/).count()) throw new Error('Detalhes do pedido na condução');
      await page.screenshot({ path: path.join(output, name + '.png') });
      results.push({ name, passed: true, nativeGuidanceValidated: false }); await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'chrome-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.length, output, mapAndHeaderAreFixtures: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
