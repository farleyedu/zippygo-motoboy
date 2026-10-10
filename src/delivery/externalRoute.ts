export type ExternalStop = { latitude?: number | null; longitude?: number | null; address?: string | null };

// O Google Maps aceita no máximo 9 paradas intermediárias no celular, mais o destino final.
export const GOOGLE_MAPS_MAX_STOPS = 10;

const validCoordinates = (stop: ExternalStop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) && Math.abs(stop.latitude) <= 90 && Math.abs(stop.longitude) <= 180;

// Coordenada tem prioridade: o endereço em texto pode ser interpretado errado pelo Maps.
export function stopPlace(stop: ExternalStop): string | null {
  if (validCoordinates(stop)) return `${stop.latitude},${stop.longitude}`;
  return stop.address?.trim() || null;
}

// Monta um único link com a rota na ordem recebida. A origem é a posição atual do aparelho.
// Paradas além do limite ficam de fora e entram quando a rota for enviada de novo.
export function googleMapsRoute(stops: ExternalStop[]): { url: string; sent: number; skipped: number; remaining: number } | null {
  const places = stops.map(stopPlace).filter((place): place is string => !!place);
  const skipped = stops.length - places.length;
  if (!places.length) return null;
  const sent = places.slice(0, GOOGLE_MAPS_MAX_STOPS), destination = sent[sent.length - 1], waypoints = sent.slice(0, -1);
  const query = [`api=1`, `destination=${encodeURIComponent(destination)}`, `travelmode=two-wheeler`];
  if (waypoints.length) query.push(`waypoints=${waypoints.map(encodeURIComponent).join('%7C')}`);
  return { url: `https://www.google.com/maps/dir/?${query.join('&')}`, sent: sent.length, skipped, remaining: places.length - sent.length };
}

// Distância em metros (haversine). Usada para saber se o motoboy já chegou perto da parada.
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (degrees: number) => degrees * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
