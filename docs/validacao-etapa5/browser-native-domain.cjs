const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '../..'), results = [];
function fixture({ platform = 'web', dev = true, environment = 'dev', enabled } = {}) {
  const calls = [], storage = new Map(), modules = new Map();
  const rejectNative = new Proxy({}, { get: (_, name) => async () => { calls.push(String(name)); throw new Error('SDK nativo nao deve ser chamado'); } });
  const external = {
    'react-native': { Platform: { OS: platform }, Linking: rejectNative, Alert: rejectNative },
    'expo-location': rejectNative, 'expo-notifications': rejectNative,
    '@react-native-async-storage/async-storage': { setItem: async () => calls.push('storage') },
    './mobileApi': { createIdentifier: () => 'test-id', MobileApiError: Error },
    './apiService': { apiClient: { post: async () => { calls.push('api'); return { status: 200, data: { data: 'real-result' } }; }, get: async () => { calls.push('api'); return { status: 200, data: { data: 'real-result' } }; } } },
    '../utils/secureStorage': { getSecureItem: async () => null, setSecureItem: async () => {}, deleteSecureItem: async () => {} },
  };
  const document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }), toDataURL: () => 'data:image/jpeg;base64,MOCK-PHOTO' }) };
  function load(file) {
    const absolute = path.resolve(root, file);
    if (modules.has(absolute)) return modules.get(absolute);
    const module = { exports: {} }; modules.set(absolute, module.exports);
    const source = fs.readFileSync(absolute, 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const requireLocal = name => {
      if (name in external) return external[name];
      return load(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts')));
    };
    new Function('module', 'exports', 'require', '__DEV__', 'process', 'document', 'sessionStorage', js)(module, module.exports, requireLocal, dev, { env: { EXPO_PUBLIC_APP_ENV: environment, EXPO_PUBLIC_BROWSER_MOCKS: enabled } }, document, { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) || null });
    return module.exports;
  }
  return { load, calls };
}
async function test(name, fn) { await fn(); results.push(name); console.log('OK ' + name); }
(async () => {
  await test('Mocks ativam somente no navegador de desenvolvimento', () => {
    assert.equal(fixture().load('services/browserNativeTest.ts').browserNativeTest, true);
    for (const options of [{ platform: 'android' }, { platform: 'ios' }, { dev: false }, { environment: 'production' }, { enabled: 'false' }]) assert.equal(fixture(options).load('services/browserNativeTest.ts').browserNativeTest, false);
  });
  await test('Todas as permissoes Web ficam liberadas sem consultar SDK', async () => {
    const f = fixture(), p = f.load('services/operationalPermissions.ts');
    const result = await p.readOperationalPermissions(); assert.equal(result.ready, true); assert.equal(result.services, true);
    for (const kind of ['foreground', 'background', 'notifications']) { assert.equal(result[kind].granted, true); await p.askOperationalPermission(kind); }
    await p.askOperationalPermission('services'); await p.openOperationalSettings(); assert.deepEqual(f.calls, []);
  });
  await test('Android continua consultando permissoes reais', async () => {
    const f = fixture({ platform: 'android' });
    await assert.rejects(() => f.load('services/operationalPermissions.ts').readOperationalPermissions(), /SDK nativo/);
    assert.deepEqual(f.calls, ['getForegroundPermissionsAsync']);
  });
  await test('Monitoramento Web inicia mock e nao publica GPS', async () => {
    const f = fixture(), setup = f.load('components/locationSetup.ts'), tracking = f.load('services/trackingService.ts');
    assert.equal(await setup.iniciarMonitoramentoLocalizacao(), true);
    await tracking.sendCurrentLocation(); await tracking.sendLocation({}); await tracking.flushLocationQueue(); await setup.pararMonitoramentoLocalizacao();
    assert.deepEqual(f.calls, []);
  });
  await test('Camera Web gera foto identificada sem acesso a hardware', async () => {
    const f = fixture(), image = f.load('services/accountImage.ts'), mock = f.load('services/browserNativeTest.ts');
    const photo = await image.chooseAccountImage(true); assert.equal(mock.isBrowserMockPhoto(photo), true);
    assert.match(mock.browserMockSnapshot(), /Camera MOCK/); assert.deepEqual(f.calls, []);
    assert.throws(() => mock.assertRealPhoto(photo), /nao foi enviada/);
    mock.assertRealPhoto('real-photo');
  });
  await test('Cadastro recusa foto mock antes de qualquer HTTP', async () => {
    const f = fixture(), photo = await f.load('services/accountImage.ts').chooseAccountImage(true);
    await assert.rejects(() => f.load('services/accountApi.ts').sendOwnImage('cnh', photo), /MOCK/); assert.deepEqual(f.calls, []);
  });
  await test('Comprovante mock anexa localmente e nao permite concluir no servidor', async () => {
    const f = fixture(), photo = await f.load('services/accountImage.ts').chooseAccountImage(true), api = f.load('services/completionApi.ts');
    const id = await api.uploadDeliveryProof(23, photo); assert.ok(id.startsWith('browser-mock-proof:'));
    assert.equal(await api.readPendingDeliveryProof(23, id), 'data:image/jpeg;base64,MOCK-PHOTO');
    await assert.rejects(() => api.completeDelivery({ proofId: id }), /nenhuma entrega foi confirmada/);
    assert.deepEqual(f.calls, []);
  });
  await test('Marcador de comprovante bloqueia envio mesmo com mocks desligados', async () => {
    const f = fixture({ enabled: 'false' }); await assert.rejects(() => f.load('services/completionApi.ts').completeDelivery({ proofId: 'browser-mock-proof:23:saved' }), /MOCK/); assert.deepEqual(f.calls, []);
  });
  await test('Fotos reais mantem o contrato original de envio', async () => {
    const f = fixture(); assert.equal(await f.load('services/completionApi.ts').uploadDeliveryProof(23, 'real-photo'), 'real-result'); assert.deepEqual(f.calls, ['api']);
  });
  await test('Navegacao mock nao abre aplicativo externo', async () => {
    const f = fixture(); await f.load('services/navigation.ts').openPreferredNavigation({}); assert.deepEqual(f.calls, []);
    assert.match(f.load('services/browserNativeTest.ts').browserMockSnapshot(), /Navegacao externa MOCK/);
  });
  await test('Discador mock nao abre ligacao externa', async () => {
    const f = fixture(), mock = f.load('services/browserNativeTest.ts'); await mock.browserNativeLinking.openURL('tel:11999999999'); assert.deepEqual(f.calls, []); assert.match(mock.browserMockSnapshot(), /Nenhuma ligacao/);
  });
  fs.writeFileSync(path.join(__dirname, 'browser-native-domain-results.json'), JSON.stringify({ passed: results.length, results, scope: 'SDKs simulados; sem banco ou provedores reais.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
