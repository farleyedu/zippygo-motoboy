const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { prepareFirebaseAndroid } = require('../../../scripts/prepare-firebase-android.cjs');
const root = path.resolve(__dirname, '../../../.expo/firebase-hook-tests');
fs.mkdirSync(root, { recursive: true });
const valid = { project_info: { project_number: '123456', project_id: 'qa-only' }, client: [{ client_info: { android_client_info: { package_name: 'com.zippy.zippyboy' } } }] };
function fixture(config) {
  const project = fs.mkdtempSync(path.join(root, 'case-'));
  const source = path.join(project, 'source.json');
  if (config) fs.writeFileSync(source, JSON.stringify(config));
  return { project, env: { EAS_BUILD_PLATFORM: 'android', GOOGLE_SERVICES_JSON: source } };
}
test('A variável de arquivo do EAS é validada, copiada e pode ser reutilizada', () => {
  const { project, env } = fixture(valid);
  assert.equal(prepareFirebaseAndroid(project, env), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, 'android/app/google-services.json'))), valid);
  assert.equal(prepareFirebaseAndroid(project, { EAS_BUILD_PLATFORM: 'android' }), true);
});
test('Recusa configuração de outro pacote Android', () => {
  const config = structuredClone(valid); config.client[0].client_info.android_client_info.package_name = 'outro.app';
  const { project, env } = fixture(config); assert.throws(() => prepareFirebaseAndroid(project, env), /pacote/);
  assert.equal(fs.existsSync(path.join(project, 'android/app/google-services.json')), false);
});
test('Uma conta de serviço nunca é incorporada ao APK', () => {
  const { project, env } = fixture({ type: 'service_account', private_key: 'fixture-sem-credencial-real' });
  assert.throws(() => prepareFirebaseAndroid(project, env), /conta de serviço/);
  assert.equal(fs.existsSync(path.join(project, 'android/app/google-services.json')), false);
});
test('Arquivo configurado ausente falha com instrução clara; sem Firebase não inventa configuração', () => {
  const { project, env } = fixture(); assert.throws(() => prepareFirebaseAndroid(project, env), /existente/);
  assert.equal(prepareFirebaseAndroid(project, { EAS_BUILD_PLATFORM: 'android' }), false);
  assert.equal(prepareFirebaseAndroid(project, { EAS_BUILD_PLATFORM: 'ios' }), false);
});
