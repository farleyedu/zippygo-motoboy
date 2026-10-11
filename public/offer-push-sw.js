/* Apenas push; não intercepta fetch nem coloca API/token em cache. */
const contextCache = 'zippygo-push-context-v1';
const contextUrl = new URL('/__push_session__', self.location.origin).href;
let contextWrite = Promise.resolve();
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'operational-session') return;
  contextWrite = contextWrite.catch(() => {}).then(() => caches.open(contextCache).then(cache => cache.put(contextUrl, new Response(JSON.stringify({ sessionId: event.data.sessionId || null })))));
  event.waitUntil(contextWrite);
});
self.addEventListener('push', event => event.waitUntil((async () => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data?.offerId || !data.recipientSessionId || !Number.isFinite(Date.parse(data.expiresAtUtc)) || Date.parse(data.expiresAtUtc) <= Date.now()) return;
  await contextWrite;
  const stored = await (await caches.open(contextCache)).match(contextUrl);
  const context = stored ? await stored.json() : null;
  if (context && context.sessionId !== data.recipientSessionId) return;
  await self.registration.showNotification('Tem pedido novo pra você', {
    body: 'Confira a rota e escolha quais pedidos aceitar.', icon: '/icon.png',
    tag: 'offer:' + data.offerId, renotify: false, requireInteraction: true,
    silent: data.sound === false, ...(data.vibration ? { vibrate: [120, 80, 120] } : {}),
    data: { offerId: data.offerId, recipientSessionId: data.recipientSessionId, expiresAtUtc: data.expiresAtUtc },
  });
})()));
self.addEventListener('notificationclick', event => {
  const data = event.notification.data; event.notification.close();
  event.waitUntil((async () => {
    if (!data || Date.parse(data.expiresAtUtc) <= Date.now()) return;
    await contextWrite;
    const stored = await (await caches.open(contextCache)).match(contextUrl), context = stored ? await stored.json() : null;
    if (context && context.sessionId !== data.recipientSessionId) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); existing.postMessage({ type: 'offer-notification', ...data }); }
    else await self.clients.openWindow('/?offerNotice=' + encodeURIComponent(data.offerId));
  })());
});
