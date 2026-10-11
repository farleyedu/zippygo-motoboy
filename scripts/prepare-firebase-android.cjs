// EAS mantém android/ deste projeto: copia a configuração sem executar prebuild.
const fs = require('node:fs'), path = require('node:path');

function prepareFirebaseAndroid(root, env = process.env) {
  if (env.EAS_BUILD_PLATFORM && env.EAS_BUILD_PLATFORM !== 'android') return false;
  const destination = path.join(root, 'android/app/google-services.json');
  const configured = env.GOOGLE_SERVICES_JSON;
  const source = configured ? path.resolve(root, configured) : [path.join(root, 'google-services.json'), destination].find(file => fs.existsSync(file));
  if (!source) {
    console.log('Firebase Android: GOOGLE_SERVICES_JSON não configurado; push remoto indisponível neste APK.');
    return false;
  }
  if (!fs.existsSync(source)) throw new Error('GOOGLE_SERVICES_JSON precisa apontar para um arquivo de configuração Android existente.');
  const raw = fs.readFileSync(source, 'utf8');
  let config;
  try { config = JSON.parse(raw); } catch { throw new Error('GOOGLE_SERVICES_JSON contém JSON inválido.'); }
  if (config.type === 'service_account' || config.private_key) throw new Error('GOOGLE_SERVICES_JSON deve ser a configuração do app Android, e não uma conta de serviço.');
  const packageName = 'com.farleyedu.zippygomotoboy';
  if (!config.client?.some(client => client.client_info?.android_client_info?.package_name === packageName)) {
    throw new Error(`A configuração Firebase precisa incluir o pacote ${packageName}.`);
  }
  if (!config.project_info?.project_number || !config.project_info?.project_id) throw new Error('A configuração Firebase está incompleta.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (path.resolve(source) !== path.resolve(destination)) fs.writeFileSync(destination, raw);
  console.log('Firebase Android: configuração validada e disponível para o Gradle.');
  return true;
}

module.exports = { prepareFirebaseAndroid };
if (require.main === module) {
  try { prepareFirebaseAndroid(path.resolve(__dirname, '..')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
