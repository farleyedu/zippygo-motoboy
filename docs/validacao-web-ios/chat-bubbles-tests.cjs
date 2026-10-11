// Valida o bundle real com API e áudio WAV controlados; não acessa pedidos reais.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const engine = process.env.QA_BROWSER || 'chromium', dist = path.resolve(__dirname, '../../dist');
const shop = { id: '11111111-1111-4111-8111-111111111111', nome: 'Loja QA' }, user = { id: '7', nome: 'Motoboy QA', role: 'motoboy' };
const session = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', epoch: 1, origin: 'mobile', clientPlatform: 'web', startedAtUtc: new Date().toISOString(), isEnded: false, version: 1, heartbeatIntervalSeconds: 25, presenceExpiresAtUtc: new Date(Date.now() + 43200000).toISOString() };
const wav = Buffer.alloc(44 + 16000 * 2 * 8); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(Math.sin((i - 44) / 2 * Math.PI * 440 / 16000) * 3000), i);
const attachment = id => ({ id, name: id + '.wav', contentType: 'audio/wav', size: wav.length });
function messages() {
  return [
    { id: 'incoming-a', body: 'Já deixei tudo separado.' },
    { id: 'incoming-b', body: 'Pode vir buscar 👍', reactions: [{ reaction: 'heart', count: 1, mine: false }] },
    { id: 'outgoing-a', mine: true, body: 'Estou chegando!' },
    { id: 'outgoing-b', mine: true, body: 'Vou conferir as bebidas de cada pedido antes de sair da loja.' },
    { id: 'reply', body: 'Combinado, as bebidas estão ao lado das sacolas.', replyTo: 'outgoing-b', replyBody: 'Vou conferir as bebidas de cada pedido antes de sair da loja.', replySender: 'Você' },
    { id: 'incoming-voice', body: '', attachment: attachment('incoming-audio') },
    { id: 'outgoing-voice', mine: true, body: '', attachment: attachment('outgoing-audio') },
  ].map((m, i) => ({ sequence: i + 1, channel: 'store', threadKey: 'store', senderName: m.mine ? user.nome : shop.nome, senderKey: m.mine ? 'motoboy:1' : 'operator:1', motoboyId: m.mine ? 1 : 2,
    mine: false, createdAtUtc: new Date(Date.now() - (7 - i) * 1000).toISOString(), readCount: 1, read: true, mentioned: false, mentions: [], reactions: [], type: 'text', status: 'read', ...m }));
}
const server = http.createServer((req, res) => {
  let file = path.resolve(dist, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html');
  if (!file.startsWith(dist + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
let browser, page, base;
const result = { engine, cases: [], errors: [] };
async function checkVoice(id) {
  const bubble = page.getByTestId('chat-bubble-' + id), voice = bubble.getByTestId('voice-message');
  await voice.waitFor({ state: 'visible' });
  await voice.getByRole('button', { name: 'Reproduzir áudio', exact: true }).waitFor({ state: 'visible' });
  const play = await voice.getByRole('button', { name: 'Reproduzir áudio', exact: true }).boundingBox();
  const wave = await voice.getByTestId('voice-waveform').boundingBox(), avatar = await voice.getByTestId('voice-avatar').boundingBox();
  const duration = await voice.getByTestId('voice-duration').boundingBox(), meta = await voice.getByTestId('message-meta').boundingBox();
  assert.ok(play.x + play.width <= wave.x && wave.x + wave.width <= avatar.x, 'Reprodução à esquerda, ondas no meio e avatar à direita.');
  assert.ok(duration.y >= wave.y + wave.height && meta.y >= wave.y + wave.height, 'Duração e horário ficam abaixo das ondas.');
  assert.ok(duration.x < meta.x && meta.x + meta.width <= avatar.x, 'Horário fica no canto direito da área das ondas.');
  assert.equal(await bubble.getByTestId('message-meta').count(), 1, 'Áudio não duplica o horário.');
  const r = await bubble.boundingBox(); assert.ok(avatar.x + avatar.width <= r.x + r.width);
  await voice.getByTestId('voice-microphone').waitFor();
  return voice;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
  for (const dark of [false, true]) for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, permissions: ['geolocation'], geolocation: { latitude: -18.92, longitude: -48.24 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ shop, user, session, dark }) => {
      const fetch = window.fetch.bind(window); window.fetch = (input, init) => { if (typeof input === 'string') { const u = new URL(input, location.href); if (u.pathname.startsWith('/api/')) return fetch(u.pathname + u.search, init); } return fetch(input, init); };
      for (const [key, value] of Object.entries({ 'zippygo.user': JSON.stringify(user), authToken: 'principal-qa', 'zippygo.token': 'principal-qa', 'zippygo.estabelecimentoAtual': JSON.stringify(shop), operationalAccessToken: 'operacional-qa', operationalSession: JSON.stringify(session), operationalEstablishmentId: shop.id, operationalUserId: user.id, 'zippygo.design.preferences.v1': JSON.stringify({ dark, reducedMotion: true }) })) localStorage.setItem(key, value);
    }, { shop, user, session, dark });
    for (const channel of ['store', 'client']) {
      page = await context.newPage(); page.setDefaultTimeout(45000); page.on('pageerror', e => result.errors.push(e.message));
      await page.routeWebSocket(/.*/, ws => ws.close());
      await page.route('**/*', route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (!p.startsWith('/api/')) return u.origin === base || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort();
        const ok = data => route.fulfill({ json: { success: true, data } });
        if (p.includes('/attachments/') || p.endsWith('/attachment')) return route.fulfill({ contentType: 'audio/wav', body: wav });
        if (p.endsWith('/vinculos')) return ok([{ estabelecimentoId: shop.id, nome: shop.nome, tipoAcesso: 'motoboy', statusVinculo: 'ativo', statusEstabelecimento: 'ativo', modulosAtivos: ['DELIVERY'] }]);
        if (p.endsWith('/session')) return ok(session);
        if (p.endsWith('/heartbeat')) return ok({ accessToken: 'operacional-qa', session });
        if (p.endsWith('/queue')) return ok({ motoboyId: 1, estabelecimentoId: shop.id, version: 3, current: null, next: [], offer: null, routeState: 'idle' });
        if (p.endsWith('/contacts') || p.endsWith('/notifications')) return ok([]);
        if (p.endsWith('/client-chat')) return ok({ channel: { pedidoId: 23, clienteNome: 'Cliente QA', podeReceber: true }, messages: messages(), hasMore: false });
        if (p.endsWith('/messages')) return ok({ messages: messages(), hasMore: false });
        return ok(null);
      });
      await page.goto(base + '/conversas?channel=' + channel + (channel === 'client' ? '&pedidoId=23' : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
      const incoming = await checkVoice('incoming-voice'); await checkVoice('outgoing-voice');
      if (engine === 'chromium') await incoming.getByTestId('voice-duration').getByText('0:08', { exact: true }).waitFor();
      // WebKit do Playwright/Windows recusa este WAV PCM (MediaError 4), inclusive
      // em HTMLAudioElement isolado. Geometria continua verificável; reprodução
      // e duração no Safari/iPhone exigem teste físico, sem simular um player.
      const a = await page.getByTestId('chat-bubble-incoming-a').boundingBox(), b = await page.getByTestId('chat-bubble-incoming-b').boundingBox();
      assert.ok(b.y - (a.y + a.height) < 7, 'Mensagens consecutivas ficam agrupadas.');
      assert.equal(await page.getByTestId('chat-bubble-reply').getByText('Vou conferir as bebidas de cada pedido antes de sair da loja.', { exact: true }).count(), 1);
      assert.ok(await page.getByTestId('chat-bubble-outgoing-a').getByTestId('message-meta').getAttribute('aria-label').then(label => label.includes('Lida')));
      for (const id of ['incoming-a', 'outgoing-a', 'outgoing-b', 'reply']) {
        const bubble = page.getByTestId('chat-bubble-' + id);
        const body = messages().find(m => m.id === id).body;
        const text = bubble.getByText(body, { exact: true });
        const lastCharacter = await text.evaluate(el => {
          const node = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          const range = document.createRange(); range.setStart(node, node.textContent.length - 1); range.setEnd(node, node.textContent.length);
          const r = range.getBoundingClientRect(); return { x: r.x, right: r.right, top: r.top, bottom: r.bottom };
        });
        const meta = await bubble.getByTestId('message-meta').boundingBox();
        if (lastCharacter.bottom > meta.y && lastCharacter.top < meta.y + meta.height) assert.ok(lastCharacter.right + 3 <= meta.x, 'Horário nunca cobre o texto da mensagem.');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'Não existe rolagem horizontal.');
      await page.screenshot({ path: path.join(__dirname, `chat-bubbles-${engine}-${channel}-${dark ? 'dark' : 'light'}-${width}.png`) });
      if (width === 390 && !dark && engine === 'chromium') {
        await incoming.getByRole('button', { name: 'Reproduzir áudio', exact: true }).click();
        await incoming.getByRole('button', { name: 'Pausar áudio', exact: true }).waitFor();
        await incoming.getByRole('button', { name: 'Velocidade 1 vezes', exact: true }).click();
        await incoming.getByRole('button', { name: 'Velocidade 1.5 vezes', exact: true }).waitFor();
        const outgoing = page.getByTestId('chat-bubble-outgoing-voice');
        await outgoing.getByRole('button', { name: 'Reproduzir áudio', exact: true }).click();
        await incoming.getByRole('button', { name: 'Reproduzir áudio', exact: true }).waitFor();
        await outgoing.getByRole('button', { name: 'Pausar áudio', exact: true }).click();
        result.cases.push({ channel, case: 'Áudio WAV real: reprodução, pausa, velocidade e exclusividade entre mensagens' });
      }
      result.cases.push({ dark, width, channel, case: 'Balões agrupados, citação, leitura e geometria do áudio conforme referência' });
      await page.close(); page = null;
    }
    await context.close();
  }
  assert.deepEqual(result.errors, []); result.ok = true;
  if (engine === 'webkit') result.audioLimitation = 'WAV PCM não decodificado no WebKit/Windows (MediaError 4); áudio real validado em Chromium, Safari/iPhone pendente.';
  fs.writeFileSync(path.join(__dirname, `chat-bubbles-${engine}-results.json`), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
})().catch(async e => {
  console.error(e.stack); process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(__dirname, `chat-bubbles-${engine}-failure.png`) }).catch(() => {});
}).finally(async () => { if (browser) await browser.close(); server.close(); });
