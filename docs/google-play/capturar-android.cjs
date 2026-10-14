// Captura o aparelho explicitamente escolhido. Não instala apps nem muda a resolução.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const adb = process.env.PLAY_ADB || path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const serial = process.env.PLAY_DEVICE_SERIAL || process.env.PLAY_EMULATOR || 'emulator-5554';
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function nodes() {
  const temporaryXml = '/data/local/tmp/zippy-google-play-window.xml';
  run('shell', 'uiautomator', 'dump', temporaryXml);
  const xml = run('shell', 'cat', temporaryXml).toString();
  run('shell', 'rm', temporaryXml);
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]));
    return attributes;
  });
}
const [command, argument] = process.argv.slice(2);
if (command === 'inspect') {
  console.log(nodes().filter(n => n.text || n['content-desc']).map(n => ({ text: n.text, label: n['content-desc'], bounds: n.bounds, class: n.class })).slice(0, 75));
} else if (command === 'tap') {
  const found = nodes().find(n => n.text === argument || n['content-desc'] === argument);
  if (!found) throw new Error(`Elemento não encontrado: ${argument}`);
  const values = [...found.bounds.matchAll(/\d+/g)].map(m => Number(m[0]));
  run('shell', 'input', 'tap', String(Math.round((values[0] + values[2]) / 2)), String(Math.round((values[1] + values[3]) / 2)));
} else if (command === 'type') {
  if (!serial.startsWith('emulator-')) throw new Error('A entrada automática de texto é limitada ao emulador.');
  run('shell', 'input', 'text', argument);
} else if (command === 'open') {
  run('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `zippygomotoboy://${argument}`, 'com.zippy.zippyboy');
} else if (command === 'capture') {
  if (!/^[a-z0-9-]+$/.test(argument || '')) throw new Error('Informe um nome simples para a captura.');
  const png = PNG.sync.read(run('exec-out', 'screencap', '-p'));
  const file = path.join(__dirname, 'originais', argument + '.png');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 2, inputColorType: 6 }));
  console.log(`${file} (${png.width} × ${png.height})`);
} else { throw new Error('Use inspect, tap, type, open ou capture.'); }
