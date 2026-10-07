// Compara as alterações com HEAD em memória, sem restaurar nem editar arquivos do projeto.
const ts = require('../../node_modules/typescript');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (!parsed.fileNames.length || config.error || parsed.errors.length) throw new Error('Configuração TypeScript inválida: ' + JSON.stringify(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))));
const original = new Map(['src/ui/Kit.tsx', 'src/ui/theme.tsx', 'app/pedido/[id].tsx'].map(file => [path.join(root, file).toLowerCase(), execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, encoding: 'utf8' })]));
function check(baseline) {
  const host = ts.createCompilerHost(parsed.options); const read = host.readFile;
  if (baseline) host.readFile = file => original.get(path.normalize(file).toLowerCase()) ?? read(file);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(item => ({ file: item.file ? path.relative(root, item.file.fileName) : null, code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }));
}
const baseline = check(true); const current = check(false);
const known = new Set(baseline.map(item => JSON.stringify(item)));
const introduced = current.filter(item => !known.has(JSON.stringify(item)));
const result = { fileCount: parsed.fileNames.length, baseline, current, introduced };
fs.writeFileSync(path.join(__dirname, 'typescript.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exitCode = introduced.length ? 1 : 0;
