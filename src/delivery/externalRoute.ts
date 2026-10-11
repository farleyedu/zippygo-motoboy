export type ExternalStop = { latitude?: number | null; longitude?: number | null; address?: string | null };

// App instalado: 9 intermediárias; navegador móvel: 3. Mais o destino final.
export const GOOGLE_MAPS_MAX_STOPS = 10;
export const GOOGLE_MAPS_BROWSER_MAX_STOPS = 4;

const validCoordinates = (stop: ExternalStop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) && Math.abs(stop.latitude) <= 90 && Math.abs(stop.longitude) <= 180;

// Agrupa destinos, nunca os pedidos. Não aproxima coordenadas de casas distintas.
export function uniqueNavigationStops<T extends ExternalStop>(stops: T[]): T[] {
  const seen = new Set<string>();
  return stops.filter(stop => {
    const address = stop.address?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s,.;]+/g, ' ').trim();
    const key = address ? `address:${address}` : validCoordinates(stop) ? `gps:${stop.latitude},${stop.longitude}` : null;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

// Coordenada tem prioridade: o endereço em texto pode ser interpretado errado pelo Maps.
export function stopPlace(stop: ExternalStop): string | null {
  if (validCoordinates(stop)) return `${stop.latitude},${stop.longitude}`;
  return stop.address?.trim() || null;
}

// Monta um único link com a rota na ordem recebida. A origem é a posição atual do aparelho.
// Paradas além do limite ficam de fora e entram quando a rota for enviada de novo.
export function googleMapsRoute(stops: ExternalStop[], maxStops = GOOGLE_MAPS_BROWSER_MAX_STOPS): { url: string; sent: number; skipped: number; remaining: number; duplicates: number } | null {
  const unique = uniqueNavigationStops(stops), places = unique.map(stopPlace);
  // Um endereço ausente não pode fazer o navegador saltar uma entrega.
  if (!places[0]) return null;
  const missing = places.findIndex(place => !place), available = places.slice(0, missing < 0 ? places.length : missing) as string[];
  const link = (selected: string[]) => {
    const query = ['api=1', `destination=${encodeURIComponent(selected[selected.length - 1])}`, 'travelmode=two-wheeler', 'dir_action=navigate'];
    if (selected.length > 1) query.push(`waypoints=${selected.slice(0, -1).map(encodeURIComponent).join('%7C')}`);
    return `https://www.google.com/maps/dir/?${query.join('&')}`;
  };
  const sent = available.slice(0, Math.max(1, Math.min(GOOGLE_MAPS_MAX_STOPS, maxStops)));
  while (sent.length > 1 && link(sent).length > 2048) sent.pop();
  if (link(sent).length > 2048) return null;
  return { url: link(sent), sent: sent.length, skipped: places.filter(p => !p).length, remaining: unique.length - sent.length, duplicates: stops.length - unique.length };
}

// Distância em metros (haversine). Usada para saber se o motoboy já chegou perto da parada.
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (degrees: number) => degrees * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
