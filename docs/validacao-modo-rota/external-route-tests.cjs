const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/delivery/externalRoute.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });
const { googleMapsRoute, stopPlace, distanceMeters, GOOGLE_MAPS_MAX_STOPS } = exported;
const stop = (n, extra = {}) => ({ latitude: -18.9 - n * 0.25, longitude: -48.2, address: 'Rua ' + n, ...extra });

test('Rota completa preserva a ordem do app: última parada é o destino, as demais são paradas', () => {
  const route = googleMapsRoute([stop(1), stop(2), stop(3)]), url = new URL(route.url);
  assert.equal(url.searchParams.get('destination'), '-19.65,-48.2');
  assert.equal(url.searchParams.get('waypoints'), '-19.15,-48.2|-19.4,-48.2');
  assert.equal(url.searchParams.get('travelmode'), 'two-wheeler');
  assert.equal(url.searchParams.get('origin'), null);
  assert.deepEqual([route.sent, route.skipped, route.remaining], [3, 0, 0]);
});
test('Uma única parada não gera waypoints', () => {
  const url = new URL(googleMapsRoute([stop(1)]).url);
  assert.equal(url.searchParams.has('waypoints'), false);
});
test('Coordenada tem prioridade; sem coordenada usa o endereço', () => {
  assert.equal(stopPlace(stop(1)), '-19.15,-48.2');
  assert.equal(stopPlace({ address: '  Rua A, 10 ' }), 'Rua A, 10');
  assert.equal(stopPlace({ latitude: 200, longitude: 0, address: 'Rua B' }), 'Rua B');
  assert.equal(stopPlace({ latitude: null, longitude: null, address: ' ' }), null);
});
test('Endereço com caracteres especiais é codificado e o separador é %7C', () => {
  const route = googleMapsRoute([{ address: 'Rua A, 10 & Cia' }, { address: 'Av. B, 20' }]);
  assert.ok(route.url.includes('waypoints=Rua%20A%2C%2010%20%26%20Cia'));
  assert.equal(new URL(route.url).searchParams.get('destination'), 'Av. B, 20');
});
test('Paradas sem endereço ficam de fora e são contadas', () => {
  const route = googleMapsRoute([stop(1), {}, stop(2)]);
  assert.deepEqual([route.sent, route.skipped], [2, 1]);
  assert.equal(googleMapsRoute([{}, { address: '' }]), null);
});
test('Acima do limite do Maps, envia só as primeiras e informa as restantes', () => {
  const route = googleMapsRoute(Array.from({ length: 13 }, (_, i) => stop(i + 1)));
  assert.equal(GOOGLE_MAPS_MAX_STOPS, 10);
  assert.deepEqual([route.sent, route.remaining], [10, 3]);
  assert.equal(new URL(route.url).searchParams.get('waypoints').split('|').length, 9);
});
test('Distância entre pontos: mesma posição é zero e ~111 m por 0,001 grau de latitude', () => {
  assert.equal(distanceMeters({ lat: -18.9, lng: -48.2 }, { lat: -18.9, lng: -48.2 }), 0);
  const d = distanceMeters({ lat: -18.9, lng: -48.2 }, { lat: -18.901, lng: -48.2 });
  assert.ok(d > 105 && d < 117, String(d));
});
