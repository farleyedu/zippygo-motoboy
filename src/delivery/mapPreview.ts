import type { MapCoordinate } from '../../components/mapTypes';
import type { MotoboyQueue, RouteStop } from '../../services/mobileApi';

export const validMapCoordinate = (point: MapCoordinate | null | undefined): point is MapCoordinate => !!point
  && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

export function mapCoordinate(latitude: unknown, longitude: unknown): MapCoordinate | undefined {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return;
  const point = { lat: Number(latitude), lng: Number(longitude) };
  return validMapCoordinate(point) ? point : undefined;
}

export function offerPreviewSegments(queue: MotoboyQueue | null, selected: number[], store?: MapCoordinate): MapCoordinate[][] {
  const active = [queue?.current, ...(queue?.next || [])].filter((stop): stop is RouteStop => !!stop);
  const activeIds = new Set(active.map(stop => stop.pedidoId));
  const offered = (queue?.offer?.stops || []).filter(stop => selected.includes(stop.pedidoId) && !activeIds.has(stop.pedidoId));
  const point = (stop: RouteStop) => mapCoordinate(stop.pedido?.latitude, stop.pedido?.longitude);
  // Entregas já coletadas vêm antes do retorno à loja para retirar a nova oferta.
  const points = [...active.filter(stop => !!stop.pickedUpAtUtc).map(point), store,
    ...active.filter(stop => !stop.pickedUpAtUtc).map(point), ...offered.map(point)];
  const segments: MapCoordinate[][] = [];
  let segment: MapCoordinate[] = [];
  for (const coordinate of points) {
    if (!validMapCoordinate(coordinate)) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(coordinate);
  }
  if (segment.length) segments.push(segment);
  return segments;
}

// Projeção do mapa em unidades do mundo (256 px no zoom 0).
const project = (point: MapCoordinate) => {
  const sin = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, point.lat)) * Math.PI / 180);
  return { x: (point.lng + 180) / 360, y: .5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
};
const unproject = (x: number, y: number): MapCoordinate => ({ lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI, lng: x * 360 - 180 });

export function previewCamera(points: MapCoordinate[], width: number, height: number, top = 70, bottom = 40) {
  const projected = points.filter(validMapCoordinate).map(project);
  if (!projected.length || width <= 0 || height <= 0) return null;
  const minX = Math.min(...projected.map(p => p.x)), maxX = Math.max(...projected.map(p => p.x));
  const minY = Math.min(...projected.map(p => p.y)), maxY = Math.max(...projected.map(p => p.y));
  const zoom = Math.max(0, Math.min(16,
    Math.log2(Math.max(1, width - 80) / (256 * Math.max(maxX - minX, 1e-9))),
    Math.log2(Math.max(1, height - top - bottom) / (256 * Math.max(maxY - minY, 1e-9)))));
  return { target: unproject((minX + maxX) / 2, (minY + maxY) / 2 + (bottom - top) / (2 * 256 * 2 ** zoom)), zoom };
}

// O SDK de navegação não expõe um padrão de traços: desenhamos trechos curtos,
// com espaçamento em pixels na visão geral e limite de chamadas à ponte nativa.
export function dashedMapSegments(segments: MapCoordinate[][], zoom: number): MapCoordinate[][] {
  const scale = 256 * 2 ** zoom;
  const legs = segments.flatMap(segment => segment.slice(1).flatMap((end, i) => {
    const start = segment[i];
    if (!validMapCoordinate(start) || !validMapCoordinate(end)) return [];
    const a = project(start), b = project(end), length = Math.hypot(b.x - a.x, b.y - a.y) * scale;
    return length > 0 ? [{ a, b, length }] : [];
  }));
  const step = Math.max(14, legs.reduce((sum, leg) => sum + leg.length, 0) / 180);
  return legs.flatMap(({ a, b, length }) => {
    const result: MapCoordinate[][] = [];
    for (let offset = 0; offset < length; offset += step) {
      const start = offset / length, end = Math.min(offset + step * .6, length) / length;
      result.push([unproject(a.x + (b.x - a.x) * start, a.y + (b.y - a.y) * start), unproject(a.x + (b.x - a.x) * end, a.y + (b.y - a.y) * end)]);
    }
    return result;
  });
}
