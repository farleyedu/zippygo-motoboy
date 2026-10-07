// Revisão isolada: todos os pedidos à API são interceptados. Nenhuma mensagem/pagamento real.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('operationalAccessToken', 'apenas-teste'));
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(120000);
  const failures = []; const requests = []; const results = [];
  page.on('pageerror', error => failures.push(error.message));
  const order = {
    id: 1842, queueVersion: 1, position: 1, stopStatus: 'en_route', isCurrent: true, isOffer: false, locked: true,
    assignedAtUtc: '2026-10-07T12:00:00Z', pickedUpAtUtc: '2026-10-07T12:05:00Z', arrivedAtUtc: null,
    origem: 'atendente', nomeCliente: 'Maria Oliveira', telefoneCliente: null, enderecoEntrega: 'Rua dos Ipês, 128',
    bairro: 'Jardim Primavera', cidade: 'São Paulo', estado: 'SP', latitude: -23.55, longitude: -46.63,
    total: 86.90, subtotal: 77.40, taxaEntrega: 9.50, formaPagamento: 'Dinheiro', statusPagamento: 'pendente', troco: 100,
    observacoes: 'Entregar na portaria. Tocar o interfone 32.', previsaoEntrega: '2026-10-07T12:45:00Z', requerCodigoEntrega: true,
    itens: [{ produtoId: 'pizza', nome: 'Pizza Calabresa', quantidade: 1, precoUnitario: 65.40, total: 65.40, adicionais: [], imagemUrl: 'http://127.0.0.1:8191/qa-foto.jpg' },
      { produtoId: 'bebida', nome: 'Refrigerante 2 litros', quantidade: 1, precoUnitario: 12, total: 12, adicionais: [], imagemUrl: null }],
  };
  let scenario = 'normal';
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/qa-foto.jpg') return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(__dirname, '../prototipo-motoboy/assets/catalogo-pizza-calabresa.jpg')) });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    requests.push({ method: request.method(), path: url.pathname, body: request.postData() });
    if (url.pathname.endsWith('/orders/1842')) {
      if (scenario === 'error') return route.fulfill({ status: 503, json: { success: false, error: 'Serviço temporariamente indisponível.' } });
      const payload = scenario === 'empty' ? { ...order, itens: [], total: null, previsaoEntrega: 'inválida', pickedUpAtUtc: null } : order;
      return route.fulfill({ json: { success: true, data: payload } });
    }
    if (url.pathname.endsWith('/stops/current/arrive')) {
      order.arrivedAtUtc = '2026-10-07T12:30:00Z';
      return route.fulfill({ json: { success: true, data: {} } });
    }
    if (url.pathname.endsWith('/messages') || url.pathname.endsWith('/group-messages') || url.pathname.endsWith('/me/estabelecimentos')) return route.fulfill({ json: { success: true, data: [] } });
    if (url.pathname.endsWith('/queue')) return route.fulfill({ json: { success: true, data: { current: null, next: [], version: 1 } } });
    return route.fulfill({ json: { success: true, data: null } });
  });
  try {
    await page.goto('http://127.0.0.1:8191/pedido/1842');
    await page.getByText('Maria Oliveira', { exact: true }).first().waitFor();
    await page.getByText('Pizza Calabresa', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cheguei ao destino', exact: true }).waitFor();
    await page.waitForFunction(() => Array.from(document.images).some(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('img').first().evaluate(img => img.complete && img.naturalWidth > 0), true);
    await page.screenshot({ path: path.join(__dirname, 'pedido-claro-390.png'), fullPage: true });
    await page.getByText('Na conferência da entrega', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, 'pedido-conferencia-claro.png'), fullPage: true });
    await page.getByRole('heading', { name: 'Detalhes do pedido', exact: true }).scrollIntoViewIfNeeded();
    results.push('Pedido com itens e foto do catálogo — 390 px');
    await page.getByRole('button', { name: 'Usar tema escuro', exact: true }).click();
    await page.getByRole('button', { name: 'Usar tema claro', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'pedido-escuro-390.png'), fullPage: true });
    await page.getByText('Na conferência da entrega', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, 'pedido-conferencia-escuro.png'), fullPage: true });
    await page.reload();
    await page.getByRole('button', { name: 'Usar tema claro', exact: true }).waitFor();
    results.push('Tema escuro persistido após recarregar; movimento reduzido');
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Sem rolagem horizontal');
    await page.screenshot({ path: path.join(__dirname, 'pedido-escuro-320.png'), fullPage: true });
    results.push('Pedido em 320 px sem rolagem horizontal');
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('[dir="auto"]')) {
        const style = getComputedStyle(element); const size = parseFloat(style.fontSize);
        element.style.fontSize = (size * 1.3) + 'px';
        if (style.lineHeight !== 'normal') element.style.lineHeight = (parseFloat(style.lineHeight) * 1.3) + 'px';
      }
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Sem rolagem horizontal com fonte ampliada');
    await page.screenshot({ path: path.join(__dirname, 'pedido-fonte-ampliada-320.png'), fullPage: true });
    results.push('Simulação web de texto 30% maior em 320 px; validação nativa permanece pendente');
    scenario = 'error'; await page.reload();
    await page.getByText('Serviço temporariamente indisponível.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Cheguei ao destino', exact: true }).count(), 0);
    await page.screenshot({ path: path.join(__dirname, 'pedido-erro.png'), fullPage: true });
    scenario = 'empty'; await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await page.getByText('Os itens não foram informados neste pedido. Confira os volumes com a loja.', { exact: true }).waitFor();
    await page.getByText('Previsão não informada', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Voltar à coleta', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'pedido-sem-itens.png'), fullPage: true });
    results.push('Falha HTTP, retry, ausência de itens/valor e previsão inválida');
    scenario = 'normal'; await page.reload();
    await page.getByRole('button', { name: 'Cheguei ao destino', exact: true }).click();
    await page.waitForURL(url => url.pathname.includes('confirmacaoEntrega') || url.pathname.includes('login'));
    assert.equal(JSON.parse(requests.find(request => request.path.endsWith('/stops/current/arrive')).body).expectedPedidoId, 1842);
    results.push('Chegada envia expectedPedidoId correto; finalização legada requer autenticação (sem sessão real nesta revisão)');
    await page.goto('http://127.0.0.1:8191/conversas');
    await page.getByRole('heading', { name: 'Conversas', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'conversas-base.png'), fullPage: true });
    results.push('Central de conversas renderiza com componentes compartilhados');
    assert.deepEqual(failures, [], 'Sem erros JavaScript de página');
    fs.writeFileSync(path.join(__dirname, 'resultado.json'), JSON.stringify({ ambiente: 'Expo Web; Chrome headless; API interceptada; sem integração real', results, requests, failures }, null, 2));
    console.log(JSON.stringify({ results, failures }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
