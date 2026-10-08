const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setup, shot, group, errors, setBrowser } = require('./browser-tests.cjs');
const results = [];
async function run(name, work) { await work(); results.push(name); console.log('OK ' + name); }
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  setBrowser(browser);
  try {
    await run('Mencao conserva destinatario apos recarga e continua marcada', async () => {
      const f = await setup();
      await f.goto('/conversas?channel=group');
      await f.page.getByText('Mencionou voce', { exact: true }).waitFor();
      await f.page.getByLabel('Mensagem', { exact: true }).fill('@Diego');
      await f.page.getByLabel('Mencionar Diego Martins').click();
      await f.page.waitForTimeout(700);
      await f.page.reload({ waitUntil: 'domcontentloaded' });
      await f.page.getByLabel('Enviar mensagem', { exact: true }).click();
      await f.page.getByText('@Diego Martins', { exact: true }).waitFor();
      assert.deepEqual(f.state.messages.at(-1).mentions, [2]);
      await f.context.close();
    });
    await run('Pagina antiga permanece apos envio e atualizacao', async () => {
      const f = await setup();
      f.state.messages = Array.from({ length: 110 }, (_, i) => ({ ...group[0], id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, sequence: i + 1, body: `Mensagem antiga ${i + 1}` }));
      f.state.sequence = 110;
      await f.goto('/conversas?channel=group');
      await f.page.getByLabel('Carregar mensagens anteriores').click();
      await f.page.getByText('Mensagem antiga 11', { exact: true }).waitFor();
      await f.page.getByLabel('Mensagem', { exact: true }).fill('Nova sem apagar historico');
      await f.page.getByLabel('Enviar mensagem', { exact: true }).click();
      await f.page.getByText('Nova sem apagar historico', { exact: true }).waitFor();
      await f.page.waitForTimeout(1000);
      assert.equal(await f.page.getByText('Mensagem antiga 11', { exact: true }).count(), 1);
      await f.page.waitForTimeout(8500);
      assert.equal(await f.page.getByText('Mensagem antiga 11', { exact: true }).count(), 1);
      await f.context.close();
    });
    await run('Aviso abre e destaca mensagem fora da primeira pagina', async () => {
      const f = await setup();
      f.state.messages = Array.from({ length: 110 }, (_, i) => ({ ...group[0], id: `60000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, sequence: i + 1, body: `Mensagem alvo ${i + 1}` }));
      const id = f.state.messages[0].id;
      await f.goto('/conversas?channel=group&messageId=' + id);
      const target = f.page.getByLabel('Mensagem de Loja: Mensagem alvo 1', { exact: true });
      await target.waitFor();
      assert.equal(await target.evaluate(el => getComputedStyle(el).borderLeftWidth), '3px');
      assert.ok(f.state.calls.some(c => c.p.endsWith(id + '/context')));
      await shot(f.page, 'correcao-mencao-mensagem-antiga');
      await f.context.close();
    });
    await run('Cliente recebe foto protegida, busca na API e reage', async () => {
      const f = await setup();
      f.state.clientEnabled = true;
      f.state.client = [{ id: '70000000-0000-4000-8000-000000000001', body: 'Portaria lateral', type: 'imagem', status: 'entregue', createdAtUtc: new Date().toISOString(), mine: false, reactions: [], attachment: { id: '70000000-0000-4000-8000-000000000001', name: 'Foto recebida', contentType: 'image/png', size: 0, clientPedidoId: 23 } }];
      await f.goto('/conversas?channel=client&pedidoId=23');
      await f.page.getByLabel('Ampliar foto').waitFor();
      await f.page.waitForFunction(() => [...document.querySelectorAll('img')].some(img => img.src.startsWith('data:image/png') && img.complete && img.naturalWidth > 0));
      assert.ok(f.state.calls.some(c => c.p.endsWith('/client-chat/messages/' + f.state.client[0].id + '/attachment')));
      await f.page.getByText('Portaria lateral', { exact: true }).click();
      await f.page.getByLabel('Curtir', { exact: true }).click();
      await f.page.getByLabel('like: 1').waitFor();
      await f.page.getByLabel('Buscar mensagens', { exact: true }).click();
      await f.page.getByLabel('Buscar mensagens do cliente').fill('Portaria');
      await f.page.waitForTimeout(700);
      // Confere o envio do termo pela URL, nao apenas filtro local de texto.
      assert.equal(await f.page.getByText('Portaria lateral', { exact: true }).count(), 1);
      assert.ok(f.state.calls.some(c => c.p.endsWith('/client-chat') && c.method === 'GET' && c.search === 'Portaria'));
      await shot(f.page, 'correcao-cliente-foto-reacao-busca');
      await f.context.close();
    });
    for (const width of [320, 390]) for (const dark of [false, true]) {
      const f = await setup(width, dark);
      await f.goto('/conversas?channel=group');
      await f.page.getByText('Mencionou voce', { exact: true }).waitFor();
      await shot(f.page, `correcao-grupo-${dark ? 'escuro' : 'claro'}-${width}`);
      f.state.clientEnabled = true;
      f.state.client = [{ id: '70000000-0000-4000-8000-000000000002', body: 'Estou na portaria', type: 'texto', status: 'entregue', createdAtUtc: new Date().toISOString(), mine: false, reactions: [] }];
      await f.goto('/conversas?channel=client&pedidoId=23');
      await f.page.getByLabel('Mensagem do cliente: Estou na portaria', { exact: true }).click();
      await f.page.getByLabel('Curtir', { exact: true }).waitFor();
      await shot(f.page, `correcao-cliente-acoes-${dark ? 'escuro' : 'claro'}-${width}`);
      await f.context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'correcoes-browser-results.json'), JSON.stringify({ results, screenshots: 10, errors, scope: 'Expo Web real, API interceptada. Nao comprova Android ou provedores reais.' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
