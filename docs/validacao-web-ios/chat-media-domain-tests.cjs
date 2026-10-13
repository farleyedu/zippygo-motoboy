// Exercita os módulos reais com transporte, armazenamento e player nativo controlados.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const React = require('react'), { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', js)(module, module.exports, name => name in mocks ? mocks[name] : require(name));
  return module.exports;
}
class Reader {
  readAsDataURL(blob) { void blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload(); }, () => this.onerror()); }
}
global.FileReader = Reader;
const cases = [], platform = { OS: 'web' };
const apiCalls = [];
let response = { status: 200, data: new Blob(['audio'], { type: 'audio/mp4' }) };
const api = {
  get: async (url, config) => { apiCalls.push({ url, config }); return response; },
  post: async (url, body, config) => { apiCalls.push({ url, body, config }); return { data: { id: 'uploaded-qa' } }; },
};
const communication = load('services/communicationApi.ts', {
  'react-native': { Platform: platform }, './apiService': { apiClient: api }, './mobileApi': { unwrap: response => response.data },
});
const writes = [], fileSystem = {
  documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: async () => {}, copyAsync: async () => {}, deleteAsync: async () => {},
  getInfoAsync: async () => ({ exists: true, size: 12 }), writeAsStringAsync: async (...args) => writes.push(args),
};
const media = load('src/chat/media.ts', {
  'react-native': { Platform: platform }, 'expo-file-system/legacy': fileSystem,
  '../../services/communicationApi': communication, '../../services/mobileApi': { createIdentifier: () => 'local-qa' },
});
const run = async (name, test) => { await test(); cases.push(name); console.log('OK ' + name); };
(async () => {
  await run('Download autenticado rejeita HTTP 403 e arquivo vazio', async () => {
    response = { status: 403, data: new Blob(['negado']) };
    await assert.rejects(() => communication.chatAttachmentData('id-qa'));
    response = { status: 200, data: new Blob([]) };
    await assert.rejects(() => communication.chatAttachmentData('id-qa'));
  });
  await run('Foto e áudio usam endpoints próprios e preservam os bytes', async () => {
    response = { status: 200, data: new Blob(['audio'], { type: 'audio/mp4' }) };
    assert.equal(await media.openChatFile('id-qa'), 'data:audio/mp4;base64,YXVkaW8=');
    assert.equal(apiCalls.at(-1).url, '/v2/motoboys/me/session/chat/attachments/id-qa');
    response = { status: 200, data: new Blob(['foto'], { type: 'image/png' }) };
    assert.equal(await media.openChatFile('photo-qa', 23), 'data:image/png;base64,Zm90bw==');
    assert.ok(apiCalls.at(-1).url.endsWith('/orders/23/client-chat/messages/photo-qa/attachment'));
    platform.OS = 'android';
    response = { status: 200, data: new Blob(['audio'], { type: 'audio/mp4' }) };
    assert.equal(await media.openChatFile('native-qa'), 'file:///cache/chat-native-qa.m4a');
    assert.equal(writes.at(-1)[1], 'YXVkaW8=');
    platform.OS = 'web';
  });
  await run('Android com Blob genérico preserva o MIME da API para foto e áudio', async () => {
    platform.OS = 'android';
    for (const type of ['audio/mp4', 'image/png']) {
      response = { status: 200, headers: { 'content-type': type + '; charset=utf-8' }, data: new Blob(['arquivo'], { type: 'application/octet-stream' }) };
      const uri = await media.openChatFile(type === 'audio/mp4' ? 'generic-audio-qa' : 'generic-photo-qa');
      assert.ok(uri.endsWith(type === 'audio/mp4' ? '.m4a' : '.png'));
      assert.equal(writes.at(-1)[1], Buffer.from('arquivo').toString('base64'));
    }
    platform.OS = 'web';
  });
  await run('Upload multipart preserva foto/áudio e destinatário, com token do turno', async () => {
    for (const type of ['image/png', 'audio/mp4']) {
      const file = { uri: `data:${type};base64,YXVkaW8=`, name: type === 'audio/mp4' ? 'audio.m4a' : 'foto.png', contentType: type };
      const saved = await media.retainChatFile(file);
      const uploaded = await communication.uploadChat({ channel: 'client', pedidoId: 23 }, saved, 'token-do-turno');
      assert.equal(uploaded.id, 'uploaded-qa');
      const call = apiCalls.at(-1), blob = call.body.get('file');
      assert.equal(blob.type, type); assert.equal(blob.name, file.name); assert.equal(await blob.text(), 'audio');
      assert.equal(call.config.params.target, 23); assert.equal(call.config.headers.Authorization, 'Bearer token-do-turno');
    }
    await assert.rejects(() => media.retainChatFile({ uri: 'data:audio/mp4;base64,', name: 'vazio.m4a', contentType: 'audio/mp4' }));
  });

  let status = { isLoaded: true, playing: false, duration: 8, currentTime: 0, error: null }, downloads = 0, rejectDownload = false;
  let modeGate = null;
  const played = [], player = { pause: () => played.push(['pause']), replace: uri => played.push(['replace', uri]), play: () => played.push(['play']), seekTo: async () => {}, setPlaybackRate: () => {} };
  const recorder = { isRecording: false, uri: 'file:///audio.m4a', prepareToRecordAsync: async () => {}, record() { this.isRecording = true; }, async stop() { this.isRecording = false; } };
  const chat = load('src/chat/ChatMedia.tsx', {
    'react': React, 'react-native': { Platform: { OS: 'android' }, ActivityIndicator: 'ActivityIndicator', Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: x => x, absoluteFill: {} }, AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-router/react-navigation': { useIsFocused: () => true },
    'expo-audio': { AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) }, RecordingPresets: { HIGH_QUALITY: {} }, setAudioModeAsync: async () => { if (modeGate) await modeGate; }, useAudioPlayer: () => player, useAudioPlayerStatus: () => status, useAudioRecorder: () => recorder, useAudioRecorderState: () => ({ durationMillis: 1000 }) },
    'lucide-react-native': Object.fromEntries(['Mic','Pause','Play','Send','Trash2','X'].map(name => [name, name])),
    '../ui/theme': { useZippyTheme: () => ({ colors: {}, dark: false }) },
    './media': { openChatFile: async () => { downloads++; if (rejectDownload) throw new Error('rede'); return 'file:///audio-' + downloads + '.m4a'; } },
    '../../services/browserNativeTest': { browserNativeTest: false }, './BrowserAudioComposer': { BrowserAudioComposer: () => null },
  });
  const button = (tree, label) => tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);
  await run('Um toque inicia o player ainda preparando e outro toque pausa sem ficar bloqueado', async () => {
    status = { ...status, isLoaded: false, error: null, playing: false };
    const props = { attachment: { id: 'tap-qa', contentType: 'audio/mp4' }, foreground: '#000' };
    let tree; await act(async () => { tree = create(React.createElement(chat.ChatMedia, props)); });
    played.length = 0;
    await act(async () => button(tree, 'Reproduzir áudio').props.onPress());
    assert.equal(played.filter(call => call[0] === 'play').length, 1, 'Não depende de um novo evento isLoaded');
    assert.ok(button(tree, 'Pausar áudio'), 'O botão responde ao primeiro toque');
    await act(async () => button(tree, 'Pausar áudio').props.onPress());
    assert.ok(button(tree, 'Reproduzir áudio'));
    assert.ok(played.some(call => call[0] === 'pause'));
    await act(async () => tree.unmount());
  });
  await run('Pausar durante o preparo cancela a reprodução pendente', async () => {
    let release; modeGate = new Promise(resolve => { release = resolve; });
    const props = { attachment: { id: 'cancel-qa', contentType: 'audio/mp4' }, foreground: '#000' };
    let tree; await act(async () => { tree = create(React.createElement(chat.ChatMedia, props)); });
    played.length = 0;
    await act(async () => button(tree, 'Reproduzir áudio').props.onPress());
    await act(async () => button(tree, 'Pausar áudio').props.onPress());
    await act(async () => { release(); await Promise.resolve(); });
    assert.equal(played.filter(call => call[0] === 'play').length, 0);
    modeGate = null;
    await act(async () => tree.unmount());
  });
  await run('Erro do player nativo permite baixar novamente e reproduzir o áudio', async () => {
    downloads = 0; played.length = 0;
    const props = { attachment: { id: 'audio-qa', contentType: 'audio/mp4' }, foreground: '#000' };
    let tree; await act(async () => { tree = create(React.createElement(chat.ChatMedia, props)); });
    assert.equal(downloads, 1);
    status = { ...status, isLoaded: false, error: 'Falha do decoder' };
    await act(async () => { tree.update(React.createElement(chat.ChatMedia, props)); });
    await act(async () => { await button(tree, 'Reproduzir áudio').props.onPress(); });
    assert.equal(downloads, 2, 'Nova tentativa baixa uma nova fonte');
    status = { ...status, isLoaded: true, error: null };
    await act(async () => { tree.update(React.createElement(chat.ChatMedia, props)); });
    assert.ok(played.some(call => call[0] === 'play'));
    await act(async () => tree.unmount());
  });
  await run('Foto recebida com falha pode ser aberta novamente', async () => {
    rejectDownload = true;
    const props = { attachment: { id: 'foto-qa', contentType: 'image/png' }, foreground: '#000' };
    let tree; await act(async () => { tree = create(React.createElement(chat.ChatMedia, props)); });
    assert.ok(button(tree, 'Tentar abrir anexo novamente'));
    rejectDownload = false;
    await act(async () => button(tree, 'Tentar abrir anexo novamente').props.onPress());
    assert.ok(tree.root.findAllByType('Image').some(image => image.props.resizeMode === 'cover'));
    await act(async () => tree.unmount());
  });
  await run('Falha de envio preserva prévia da gravação até entrar na fila', async () => {
    let attempts = 0; const failures = [];
    const send = async () => { if (++attempts === 1) throw new Error('Falha no armazenamento'); };
    let tree; await act(async () => { tree = create(React.createElement(chat.AudioComposer, { disabled: false, send, onError: e => failures.push(e) })); });
    await act(async () => button(tree, 'Gravar audio').props.onPress());
    await act(async () => button(tree, 'Concluir gravacao').props.onPress());
    await act(async () => button(tree, 'Enviar audio').props.onPress());
    assert.ok(button(tree, 'Enviar audio')); assert.match(failures[0], /Falha no armazenamento/);
    await act(async () => button(tree, 'Enviar audio').props.onPress());
    assert.ok(button(tree, 'Gravar audio')); assert.equal(attempts, 2);
    await act(async () => tree.unmount());
  });
  const output = path.resolve(__dirname, '../../.expo/validation-chat-media'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'domain-results.json'), JSON.stringify({ passed: cases.length, cases }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
