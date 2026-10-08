const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { setup, errors, setBrowser } = require('../validacao-etapa5/browser-tests.cjs');
const out = path.join(__dirname, 'captures');
const now = new Date().toISOString();
const settlement = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'draft', earnings: 18.84, storeCash: 66.90, cashReturned: false, createdAtUtc: now };
const entries = [{ id: 'entry1', kind: 'delivery', mode: 'distance', amount: 8.34, storeCash: 66.90, pedidoId: 23, stopId: 1, settlementId: settlement.id, fromUtc: now, toUtc: now }, { id: 'entry2', kind: 'delivery', mode: 'delivery', amount: 10.50, storeCash: 0, pedidoId: 24, stopId: 2, settlementId: settlement.id, fromUtc: now, toUtc: now }];
const receipt = { CodeChecked: true, PaidBeforeDelivery: false, Payments: [{ Method: 'dinheiro', Amount: 66.90, CashReceived: 100 }] };
const fixture = { plan: { id: 'plan', mode: 'distance', rate: 2.50, createdAtUtc: now }, entries, settlementEntries: entries, settlements: [settlement], balance: { outstanding: 18.84, cashToReturn: 66.90 }, history: [{ stopId: 1, pedidoId: 23, status: 'completed', district: 'Centro', amount: 8.34, mode: 'distance', assignedAtUtc: now, pickedUpAtUtc: now, arrivedAtUtc: now, updatedAtUtc: now, receipt }], earnings: 18.84, unpricedDeliveries: 0, support: [] };
async function capture(page, name) { await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ': overflow'); }
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] }); setBrowser(browser);
  const results = [];
  try {
    for (const [width, dark] of [[320, false], [390, true]]) {
      const f = await setup(width, dark, { keepMetroWebSocket: true }), work = structuredClone(fixture), actions = [];
      f.page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()); });
      f.page.on('pageerror', error => console.error('PAGE ERROR', error.message));
      f.page.on('response', response => { if (response.status() >= 400) console.error('HTTP', response.status(), response.url()); });
      await f.page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9mEAAAAASUVORK5CYII=', 'base64'), contentType: 'image/png' }));
      await f.page.route(/\/api\/motoboys\/me\/work(?:\/|\?|$)/, async route => {
        const url = new URL(route.request().url()), body = JSON.parse(route.request().postData() || 'null');
        assert.equal(route.request().headers().authorization, 'Bearer principal-qa');
        if (route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: work } });
        actions.push({ path: url.pathname, body });
        console.log('ACTION', url.pathname, body);
        if (url.pathname.endsWith('/support')) { work.support.push({ id: body.operationId, category: body.category, message: body.message, createdAtUtc: now }); return route.fulfill({ json: { success: true, data: body.operationId } }); }
        if (body.action === 'review') work.settlements[0].status = 'reviewed';
        if (body.action === 'dispute') { work.settlements[0].status = 'disputed'; work.settlements[0].reason = body.reason; }
        if (body.action === 'receive') work.settlements[0].status = 'received';
        return route.fulfill({ json: { success: true, data: true } });
      });
      await f.goto('/ganhos'); await f.page.getByText('SEUS GANHOS CONFERIDOS NO PERÍODO').waitFor(); await capture(f.page, `ganhos-${width}`);
      await f.goto('/historico'); await f.page.getByText('#23 · Centro').waitFor(); await capture(f.page, `historico-${width}`);
      await f.page.getByRole('button', { name: '#23 · Centro', exact: true }).click(); await f.page.getByText('Conferido no servidor').waitFor(); await capture(f.page, `recibo-${width}`);
      await f.goto('/acerto'); await f.page.getByText('Aguardando sua conferência', { exact: true }).waitFor();
      assert.equal(await f.page.getByRole('button', { name: 'Confirmar conferência', exact: true }).isDisabled(), true);
      await f.page.getByRole('checkbox').scrollIntoViewIfNeeded(); await f.page.waitForTimeout(300); await f.page.getByRole('checkbox').click();
      const confirm = f.page.getByRole('button', { name: 'Confirmar conferência', exact: true });
      await confirm.scrollIntoViewIfNeeded(); await f.page.waitForTimeout(300); await confirm.click();
      try { await f.page.getByText('Conferido · pagamento pendente').waitFor(); } catch (e) { console.error(await f.page.locator('body').innerText()); await capture(f.page, 'failure'); throw e; }
      assert.equal(actions.at(-1).body.action, 'review');
      await f.page.getByRole('button', { name: 'Encontrei uma diferença', exact: true }).click(); await f.page.getByLabel('O que precisa ser revisado?').fill('Preciso revisar os recebimentos'); await f.page.getByRole('button', { name: 'Registrar divergência', exact: true }).click(); await f.page.getByText('Divergência registrada').waitFor();
      await capture(f.page, `acerto-contestado-${width}`);
      work.settlements[0].status = 'paid'; work.settlements[0].reference = 'PIX-QA'; work.settlements[0].method = 'pix';
      await f.goto('/acerto'); await f.page.getByText('Loja registrou pagamento · confira o recebimento').waitFor(); await f.page.getByRole('checkbox').click(); await f.page.getByRole('button', { name: 'Confirmar que recebi', exact: true }).click(); await f.page.getByText('Recebimento confirmado', { exact: true }).waitFor();
      await f.goto('/suporte?category=security'); await f.page.getByLabel('Descreva o que aconteceu').fill('Situação insegura no destino'); await f.page.getByRole('button', { name: 'Registrar solicitação para a loja', exact: true }).click(); await f.page.getByText('Solicitação registrada', { exact: true }).waitFor(); assert.equal(actions.at(-1).body.category, 'security'); await capture(f.page, `suporte-${width}`);
      await f.goto('/seguranca'); await f.page.getByLabel('Nome', { exact: true }).fill('Contato QA'); await f.page.getByLabel('Telefone com DDD').fill('11999990000'); await f.page.getByRole('button', { name: 'Salvar contato neste aparelho', exact: true }).click(); await f.page.getByText('Contato salvo neste aparelho, somente para sua conta.').waitFor(); await f.page.getByRole('button', { name: 'Abrir discador · Polícia 190', exact: true }).click(); await f.page.getByText('Discador MOCK no navegador. Nenhuma ligacao foi iniciada.', { exact: true }).waitFor(); await capture(f.page, `seguranca-${width}`);
      await f.goto('/resumoTurno'); await f.page.getByText('Existem pendências', { exact: true }).waitFor(); assert.equal(await f.page.getByRole('button', { name: 'Encerrar meu turno', exact: true }).isDisabled(), true); await capture(f.page, `resumo-${width}`);
      const offerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      await f.page.route('**/api/v2/motoboys/me/session/queue', route => route.fulfill({ json: { success: true, data: { motoboyId: 1, estabelecimentoId: '11111111-1111-1111-1111-111111111111', version: 12, next: [], current: null, routeState: 'idle', politicas: {}, offer: { offerId, expiresAtUtc: new Date(Date.now() + 300000).toISOString(), stops: [{ pedidoId: 23, position: 1, status: 'offered', pedido: { bairro: 'Centro' }, earnings: { mode: 'distance', rate: 2.50, distanceKm: 3.334, amount: 8.34 } }, { pedidoId: 24, position: 2, status: 'offered', pedido: { bairro: 'Centro' }, earnings: { mode: 'delivery', rate: 10.50, amount: 10.50 } }] } } } }));
      await f.goto('/oferta'); await f.page.getByText('Total das entregas desta oferta').waitFor();
      let accepted = false;
      await f.page.route('**/api/v2/motoboys/me/session/queue/offer/accept', async route => { const body = JSON.parse(route.request().postData()); assert.equal(body.expectedVersion, 12); assert.equal(body.expectedOfferId, offerId); accepted = true; return route.fulfill({ status: 409, json: { success: false, code: 'OFFER_EARNINGS_CHANGED', error: 'Confira novamente os ganhos.' } }); });
      await f.page.getByRole('button', { name: 'Aceitar e conferir rota', exact: true }).click();
      try { await f.page.getByText('Confira novamente os ganhos.', { exact: true }).waitFor(); } catch (e) { console.error('ACCEPTED', accepted, 'CALLS', f.state.calls.filter(c => c.method === 'POST').slice(-10)); console.error(await f.page.locator('body').innerText()); throw e; } assert.equal(accepted, true); await capture(f.page, `oferta-${width}`);
      await f.context.close(); results.push(`${width}: ganhos, histórico, recibo, conferência, contestação, recebimento, suporte, segurança mock, bloqueio de encerramento e oferta detalhada`);
    }
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ results, errors, scope: 'Expo Web real com API interceptada; sem pagamento, ligação ou mensagem reais.' }, null, 2)); console.log(results.join('\n'));
  } catch (e) {
    for (const context of browser.contexts()) for (const page of context.pages()) { console.error('FAILED URL', page.url(), await page.locator('body').innerText().catch(() => '')); await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); }
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
