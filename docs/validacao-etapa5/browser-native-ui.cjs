const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { setup, shot, errors, setBrowser } = require('./browser-tests.cjs');
const results = [];
async function test(name, work) { await work(); results.push(name); console.log('OK ' + name); }
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  setBrowser(browser);
  try {
    for (const [width, dark] of [[320, false], [390, true]]) {
      const f = await setup(width, dark);
      await f.context.addInitScript(() => {
        window.nativeMockCalls = [];
        for (const name of ['getCurrentPosition', 'watchPosition']) navigator.geolocation[name] = () => { window.nativeMockCalls.push(name); throw new Error('GPS real proibido neste teste'); };
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.nativeMockCalls.push('getUserMedia'); throw new Error('Microfone/camera reais proibidos neste teste'); };
      });
      await test(`Permissoes liberadas e aviso permanente ${width}`, async () => {
        await f.goto('/permissoes');
        await f.page.getByText('Permissoes liberadas · MOCK no navegador', { exact: true }).waitFor();
        const begin = f.page.getByRole('button', { name: 'Retomar meu turno', exact: true });
        await begin.waitFor();
        await f.page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')].some(el => el.textContent === 'Retomar meu turno' && el.getAttribute('aria-disabled') !== 'true'));
        assert.equal(await begin.isDisabled(), false);
        assert.equal(await f.page.getByText('Localização com o app aberto', { exact: true }).count(), 0);
        await shot(f.page, `browser-mock-permissoes-${width}`);
        await f.page.getByLabel('Simular notificacao no navegador').click();
        await f.page.getByText('Notificacao MOCK recebida no navegador. Nenhum push real foi enviado.', { exact: true }).waitFor();
      });
      await test(`Audio gravacao previa e envio somente local ${width}`, async () => {
        await f.goto('/conversas?channel=group');
        await f.page.getByLabel('Gravar audio', { exact: true }).click();
        await f.page.getByText('Audio MOCK no navegador', { exact: true }).waitFor();
        await f.page.getByLabel('Concluir gravacao', { exact: true }).click();
        await shot(f.page, `browser-mock-audio-${width}`);
        const before = f.state.calls.filter(c => c.method === 'POST' && /\/messages$|\/attachments$/.test(c.p)).length;
        await f.page.getByLabel('Enviar audio', { exact: true }).click();
        await f.page.getByText('Envio de audio MOCK concluido apenas no navegador. Nao foi enviado ao chat, cliente ou loja.', { exact: true }).waitFor();
        assert.equal(f.state.calls.filter(c => c.method === 'POST' && /\/messages$|\/attachments$/.test(c.p)).length, before);
      });
      await test(`Camera gera previa e comprovante mock sem HTTP ${width}`, async () => {
        await f.page.evaluate(() => sessionStorage.setItem('zippygo.completion.7', JSON.stringify({ userId: '7', storeId: '11111111-1111-1111-1111-111111111111', sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', epoch: 1, phase: 'draft', codeChecked: false, context: { pedidoId: 23, version: 1, requiresCode: false, requiresPayment: false, requiresProof: true }, request: { operationId: '99999999-9999-4999-8999-999999999999', expectedPedidoId: 23, expectedVersion: 1, payments: [] } })));
        await f.goto('/comprovanteEntrega');
        await f.page.getByLabel('Fotografar o pedido', { exact: true }).click();
        await f.page.getByText('Camera MOCK: foto gerada no navegador, sem acesso a camera.', { exact: true }).waitFor();
        await f.page.waitForFunction(() => [...document.querySelectorAll('img')].some(i => i.src.startsWith('data:image/jpeg') && i.complete && i.naturalWidth === 640));
        await shot(f.page, `browser-mock-camera-${width}`);
        await f.page.getByRole('button', { name: 'Anexar esta foto', exact: true }).click();
        await f.page.waitForFunction(() => JSON.parse(sessionStorage.getItem('zippygo.completion.7')).request.proofId?.startsWith('browser-mock-proof:'));
        assert.equal(f.state.calls.filter(c => c.method === 'POST' && c.p.endsWith('/proof')).length, 0);
        assert.deepEqual(await f.page.evaluate(() => window.nativeMockCalls), []);
      });
      await f.context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'browser-native-ui-results.json'), JSON.stringify({ results, screenshots: 6, errors, scope: 'Expo Web real com API interceptada; hardware e permissoes reais proibidos pelos testes.' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
