const { test } = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../../public/offer-push-sw.js'), 'utf8');
function fixture(existing = false) {
  const listeners = {}, stored = new Map(), shown = [], focused = [], messages = [], opened = [];
  const self = { location: { origin: 'https://qa.exemplo.invalid' },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
    clients: { matchAll: async () => existing ? [{ url: 'https://qa.exemplo.invalid/mapa', focus: async () => focused.push(true), postMessage: data => messages.push(data) }] : [], openWindow: async url => opened.push(url) },
  };
  vm.runInNewContext(script, { self, URL, Response, Date, caches: { open: async () => ({ put: async (key, value) => stored.set(key, value), match: async key => stored.get(key)?.clone() }) } });
  const fire = async (type, data) => { let work; listeners[type]({ data, notification: { data, close() {} }, waitUntil: value => { work = value; } }); await work; };
  return { shown, messages, opened, focused, context: sessionId => fire('message', { type: 'operational-session', sessionId }), push: data => fire('push', { json: () => data }), click: data => fire('notificationclick', data) };
}
const offer = () => ({ offerId: 'oferta-qa', recipientSessionId: 'turno-qa', expiresAtUtc: new Date(Date.now() + 60000).toISOString(), sound: true, vibration: true });
test('Push web de oferta usa aviso persistente e identidade sem aceitar pedidos', async () => {
  const f = fixture(); await f.context('turno-qa'); await f.push(offer());
  assert.equal(f.shown.length, 1); assert.equal(f.shown[0].tag, 'offer:oferta-qa'); assert.equal(f.shown[0].requireInteraction, true);
  assert.equal(f.shown[0].data.recipientSessionId, 'turno-qa'); assert.equal(f.opened.length, 0);
  assert.equal(f.shown[0].renotify, false, 'Reenvio com a mesma tag atualiza o aviso sem repetir o alerta.');
});
test('Oferta expirada, alheia ou recebida após logout não aparece', async () => {
  const f = fixture(); await f.context('turno-qa');
  await f.push({ ...offer(), expiresAtUtc: new Date(Date.now() - 1).toISOString() });
  await f.push({ ...offer(), recipientSessionId: 'turno-alheio' });
  await f.context(null); await f.push(offer()); assert.equal(f.shown.length, 0);
});
test('Toque no aviso reabre sobre o mapa e preserva a página atual', async () => {
  const f = fixture(true); await f.context('turno-qa'); await f.click(offer());
  assert.equal(f.focused.length, 1); assert.equal(f.opened.length, 0);
  assert.equal(f.messages[0].type, 'offer-notification'); assert.equal(f.messages[0].offerId, 'oferta-qa');
});
test('Abertura a frio usa início com retomada automática; aviso vencido não abre nada', async () => {
  const f = fixture(); await f.context('turno-qa'); await f.click(offer());
  assert.equal(f.opened[0], '/?offerNotice=oferta-qa');
  await f.click({ ...offer(), expiresAtUtc: new Date(Date.now() - 1).toISOString() }); assert.equal(f.opened.length, 1);
});
