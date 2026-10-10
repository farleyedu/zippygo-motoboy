const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const results = [];
const settings = { sound: true, vibration: true, muted: false, mentionAlerts: true };
function fixture(options = {}) {
  const calls = [], channels = [];
  let permission = options.permission || { granted: false, canAskAgain: true, status: 'undetermined' };
  const notifications = {
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    setNotificationChannelAsync: async (id, value) => {
      // O SDK Android exige arquivo raw para todo sound explicito nao nulo.
      // Campo ausente usa o som do sistema; null configura um canal silencioso.
      if (Object.hasOwn(value, 'sound') && value.sound !== null) {
        assert.equal(typeof value.sound, 'string');
        assert.ok(fs.existsSync(path.join(root, 'android/app/src/main/res/raw', value.sound)), `Som de canal inexistente: ${value.sound}`);
      }
      calls.push('channel'); channels.push({ id, ...value });
    },
    getPermissionsAsync: async () => { calls.push('get'); return permission; },
    requestPermissionsAsync: async () => { calls.push('request'); permission = options.answer || { granted: true, canAskAgain: true, status: 'granted' }; return permission; },
    getExpoPushTokenAsync: async () => { calls.push('token'); return { data: 'ExpoPushToken[test]' }; },
  };
  const modules = {
    'react-native': { Platform: { OS: options.platform || 'android' } },
    'expo-notifications': notifications,
    '../../services/apiService': { apiClient: { put: async () => { calls.push('put'); return {}; } } },
    '../../services/mobileApi': { unwrap: value => value },
    '../../services/browserNativeTest': { browserNativeTest: !!options.browserMock, reportBrowserMock: () => calls.push('mock') },
    '../../services/expoGo': { expoGo: false },
    '../../utils/secureStorage': { getSecureItem: async key => key === 'operationalSession' ? JSON.stringify({ sessionId: options.session || 'current' }) : 'access' },
    'expo-location': {},
    './browserNativeTest': { browserNativeTest: !!options.browserMock, reportBrowserMock: () => calls.push('mock') },
    './expoGo': { expoGo: false },
  };
  const source = fs.readFileSync(path.join(root, options.operational ? 'services/operationalPermissions.ts' : 'src/chat/push.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', js)(module, module.exports, name => {
    assert.ok(name in modules, name);
    return modules[name];
  });
  return { ...module.exports, calls, channels };
}
async function test(name, work) { await work(); results.push(name); console.log('OK ' + name); }
(async () => {
  await test('Web nao solicita permissao nem registra push', async () => {
    const f = fixture({ platform: 'web' });
    assert.equal(await f.ensureChatNotificationPermission(true), 'unsupported');
    await f.registerChatPush('current', settings);
    assert.deepEqual(f.calls, []);
  });
  await test('Web de teste libera permissao mock sem gerar token ou HTTP', async () => {
    const f = fixture({ platform: 'web', browserMock: true });
    assert.equal(await f.ensureChatNotificationPermission(true), 'granted');
    await f.registerChatPush('current', settings); assert.deepEqual(f.calls, ['mock']);
  });
  await test('Instalacao nova cria canais antes do pedido e registra apos concessao', async () => {
    const f = fixture(); await f.registerChatPush('current', settings);
    assert.equal(f.channels.length, 12);
    assert.equal(new Set(f.channels.map(channel => channel.id)).size, 12);
    assert.ok(f.calls.indexOf('channel') < f.calls.indexOf('request'));
    assert.ok(f.calls.indexOf('request') < f.calls.indexOf('token'));
    assert.equal(f.calls.at(-1), 'put');
    const chatChannels = f.channels.filter(channel => channel.id.startsWith('chat-'));
    const offerChannels = f.channels.filter(channel => channel.id.startsWith('delivery-offers-'));
    assert.equal(chatChannels.length, 8);
    assert.equal(offerChannels.length, 4);
    for (const channel of chatChannels) {
      assert.ok(channel.id.endsWith('-v2'));
      assert.equal(channel.importance, channel.id.includes('mentions') ? 4 : 3);
      assert.equal(channel.enableVibrate, channel.id.includes('-vibrate-'));
      assert.equal(channel.sound, channel.id.includes('-silent-') ? null : channel.id.includes('mentions') ? 'chat_mention.wav' : 'chat_message.wav');
    }
    for (const channel of offerChannels) {
      assert.match(channel.id, /^delivery-offers-(sound|silent)-(vibrate|quiet)-v1$/);
      assert.equal(channel.importance, 4);
      assert.equal(channel.enableVibrate, channel.id.includes('-vibrate-'));
      if (channel.id.includes('-silent-')) assert.equal(channel.sound, null);
      else assert.equal(Object.hasOwn(channel, 'sound'), false);
    }
  });
  await test('Negativa nao repete prompt em atualizacoes automaticas nem busca token', async () => {
    const f = fixture({ answer: { granted: false, canAskAgain: true, status: 'denied' } });
    await f.registerChatPush('current', settings); await f.registerChatPush('current', settings);
    assert.equal(f.calls.filter(c => c === 'request').length, 1);
    assert.equal(f.calls.includes('token'), false);
  });
  await test('Pedido explicito pode tentar novamente quando sistema permite', async () => {
    const f = fixture({ permission: { granted: false, canAskAgain: true, status: 'denied' } });
    assert.equal(await f.ensureChatNotificationPermission(), 'denied');
    assert.equal(await f.ensureChatNotificationPermission(true), 'granted');
    assert.equal(f.calls.filter(c => c === 'request').length, 1);
  });
  await test('Bloqueio definitivo nao provoca novo pedido nem registro', async () => {
    const f = fixture({ permission: { granted: false, canAskAgain: false, status: 'denied' } });
    assert.equal(await f.ensureChatNotificationPermission(true), 'blocked');
    await f.registerChatPush('current', settings);
    assert.equal(f.calls.includes('request'), false); assert.equal(f.calls.includes('put'), false);
  });
  await test('Chamadas concorrentes compartilham um unico pedido de permissao', async () => {
    const f = fixture();
    assert.deepEqual(await Promise.all([f.ensureChatNotificationPermission(), f.ensureChatNotificationPermission(true)]), ['granted', 'granted']);
    assert.equal(f.calls.filter(c => c === 'request').length, 1); assert.equal(f.channels.length, 12);
  });
  await test('Troca de sessao impede vincular token ao turno antigo', async () => {
    const f = fixture({ session: 'other' }); await f.registerChatPush('current', settings);
    assert.equal(f.calls.includes('put'), false);
  });
  await test('iOS solicita alertas e som sem criar canais Android', async () => {
    const f = fixture({ platform: 'ios' });
    assert.equal(await f.ensureChatNotificationPermission(), 'granted'); assert.equal(f.channels.length, 0);
  });
  await test('Preparacao Android usa som do sistema e cria canal antes de pedir permissao', async () => {
    const f = fixture({ operational: true });
    await f.askOperationalPermission('notifications');
    assert.equal(f.channels.length, 1); assert.equal(f.channels[0].id, 'default');
    assert.equal(Object.hasOwn(f.channels[0], 'sound'), false);
    assert.deepEqual(f.calls, ['channel', 'request']);
  });
  await test('Preparacao iOS solicita notificacoes sem criar canal Android', async () => {
    const f = fixture({ operational: true, platform: 'ios' });
    await f.askOperationalPermission('notifications');
    assert.deepEqual(f.calls, ['request']);
  });
  await test('WAV nativo corresponde ao asset e contratos usam nomes validos', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    const backend = fs.readFileSync(path.resolve(root, '../motoboyBackEnd/Service/ChatPushService.cs'), 'utf8');
    for (const name of ['chat_message.wav', 'chat_mention.wav']) {
      assert.match(name, /^[a-z0-9_]+\.wav$/);
      const source = fs.readFileSync(path.join(root, 'assets/sounds', name));
      assert.equal(source.toString('ascii', 0, 4), 'RIFF');
      assert.equal(source.toString('ascii', 8, 12), 'WAVE');
      assert.deepEqual(fs.readFileSync(path.join(root, 'android/app/src/main/res/raw', name)), source);
      assert.ok(config.includes(name)); assert.ok(backend.includes(name));
    }
    assert.ok(backend.includes('-v2'));
  });
  fs.writeFileSync(path.join(__dirname, 'push-native-results.json'), JSON.stringify({ passed: results.length, results, scope: 'SDKs simulados e integridade de assets; nao comprova execucao em aparelho.' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
