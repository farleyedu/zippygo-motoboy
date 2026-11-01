import { describe, expect, it } from '@jest/globals';
import type { MotoboyQueue, RouteStop } from '../../services/mobileApi';
import { dashedMapSegments, mapCoordinate, offerPreviewSegments, previewCamera } from './mapPreview';

const store = { lat: -18.92, lng: -48.242 };
const stop = (pedidoId: number, lat = Number((-18.92 + pedidoId * .001).toFixed(3)), pickedUpAtUtc?: string): RouteStop => ({
  pedidoId, position: pedidoId, status: 'assigned', assignedAtUtc: '', locked: false, pickedUpAtUtc,
  pedido: { id: pedidoId, latitude: lat, longitude: -48.24 },
});
const queue = (active: RouteStop[], offered: RouteStop[]): MotoboyQueue => ({
  current: active[0] || null, next: active.slice(1), offer: { stops: offered },
} as MotoboyQueue);

describe('prévia do trajeto antes do aceite', () => {
  it('inclui loja e uma única entrega, mantendo paradas aceitas antes da oferta', () => {
    const segments = offerPreviewSegments(queue([stop(1)], [stop(2)]), [2], store);
    expect(segments).toEqual([[store, { lat: -18.919, lng: -48.24 }, { lat: -18.918, lng: -48.24 }]]);
    expect(offerPreviewSegments(queue([], [stop(2)]), [2], store)[0]).toHaveLength(2);
  });

  it('retorna à coleta depois das entregas já retiradas e remove só ofertas desmarcadas', () => {
    const data = queue([stop(1, -18.919, '2026-10-18T12:00:00Z'), stop(2)], [stop(3), stop(4)]);
    expect(offerPreviewSegments(data, [4], store)[0]).toEqual([
      { lat: -18.919, lng: -48.24 }, store, { lat: -18.918, lng: -48.24 }, { lat: -18.916, lng: -48.24 },
    ]);
    expect(offerPreviewSegments(data, [], store)[0]).toHaveLength(3);
  });

  it('não desenha atalhos sobre uma parada sem coordenadas nem duplica pedidos aceitos', () => {
    const missing = { ...stop(2), pedido: null };
    const data = queue([stop(1)], [stop(1), missing, stop(3)]);
    expect(offerPreviewSegments(data, [1, 2, 3], store).map(segment => segment.length)).toEqual([2, 1]);
  });

  it('aceita coordenadas numéricas da loja, incluindo zero, e rejeita pontos inválidos', () => {
    expect(mapCoordinate('0', '-48.24')).toEqual({ lat: 0, lng: -48.24 });
    for (const latitude of [undefined, null, '', NaN, Infinity, 91]) expect(mapCoordinate(latitude, -48)).toBeUndefined();
    expect(mapCoordinate(-18, 181)).toBeUndefined();
  });
});

describe('enquadramento e tracejado no mapa nativo', () => {
  const project = (lat: number, lng: number, zoom: number) => {
    const sin = Math.sin(lat * Math.PI / 180), scale = 256 * 2 ** zoom;
    return { x: (lng + 180) / 360 * scale, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
  };
  it('enquadra os extremos de um trajeto comprido acima dos controles em telas estreitas', () => {
    const points = [store, { lat: -18.99, lng: -48.22 }, { lat: -18.91, lng: -48.23 }];
    for (const width of [320, 390]) {
      const camera = previewCamera(points, width, 240, 85, 60)!;
      const center = project(camera.target.lat, camera.target.lng, camera.zoom);
      for (const point of points) {
        const projected = project(point.lat, point.lng, camera.zoom);
        const x = projected.x - center.x + width / 2, y = projected.y - center.y + 120;
        expect(x).toBeGreaterThanOrEqual(39.99); expect(x).toBeLessThanOrEqual(width - 39.99);
        expect(y).toBeGreaterThanOrEqual(84.99); expect(y).toBeLessThanOrEqual(180.01);
      }
    }
    expect(previewCamera([], 390, 240)).toBeNull();
    expect(previewCamera(points, 0, 0)).toBeNull();
  });

  it('produz traços com espaços, limita a quantidade e mantém as quebras da rota', () => {
    const segments = [[store, { lat: -18.93, lng: -48.24 }], [{ lat: -19.5, lng: -48.2 }, { lat: -20, lng: -48.2 }]];
    const dashes = dashedMapSegments(segments, 16);
    expect(dashes.length).toBeGreaterThan(2); expect(dashes.length).toBeLessThanOrEqual(182);
    expect(dashes[0][1]).not.toEqual(dashes[1][0]);
    expect(dashes.every(([a, b]) => Math.abs(a.lat - b.lat) < .05)).toBe(true);
    expect(dashedMapSegments([[store, store]], 16)).toEqual([]);
  });
});
