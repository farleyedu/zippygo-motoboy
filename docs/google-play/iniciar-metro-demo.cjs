// Ambiente do processo isolado; não modifica .env nem a configuração do app.
const { spawn } = require('node:child_process');
const path = require('node:path');
(async () => {
  const status = await fetch('http://127.0.0.1:4358/demo/status');
  if (!status.ok) throw new Error('Inicie primeiro a API local de demonstração.');
  const root = path.resolve(__dirname, '../..');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'start', '--dev-client', '--localhost', '--max-workers', '2', '--port', '8081'], {
    cwd: root, stdio: 'inherit', shell: false,
    env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4358', EXPO_PUBLIC_APP_ENV: 'dev', EXPO_OFFLINE: '1' },
  });
  child.on('exit', code => { process.exitCode = code || 0; });
  process.on('SIGINT', () => child.kill('SIGINT'));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
