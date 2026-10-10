import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { Pedido } from '../types/pedido';
import { useZippyTheme } from '../src/ui/theme';
import 'leaflet/dist/leaflet.css';
import { browserNativeTest } from '../services/browserNativeTest';

type Props = { pedidos: Pedido[]; emEntrega: boolean; recenterToken?: number; routeMode?: boolean; mapClean?: boolean; onOrderPress?: (id: number) => void; view3D?: boolean };
export default function Mapa({ pedidos, mapClean, onOrderPress, recenterToken, routeMode }: Props) {
  const { dark } = useZippyTheme(), container = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), [ready, setReady] = useState(false);
  const position = useRef<[number, number] | null>(null);
  useEffect(() => { let alive = true; let watch: number | undefined; import('leaflet').then(L => {
    if (!alive || !container.current) return;
    const instance = L.map(container.current, { zoomControl: false, attributionControl: true }); map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(instance);
    const coords = pedidos.map(p => p.coordinates).filter((c): c is { lat: number; lng: number } => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (coords.length) instance.fitBounds(coords.map(c => [c.lat, c.lng]), { padding: [25, 25], maxZoom: 15 }); else instance.setView([0, 0], 2);
    const rider = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 3, fillColor: '#397df0', fillOpacity: 1 });
    if (browserNativeTest) {
      position.current = coords.length ? [coords[0].lat + 0.002, coords[0].lng + 0.002] : [-23.5505, -46.6333];
      rider.setLatLng(position.current).bindTooltip('GPS MOCK no navegador').addTo(instance);
      if (!coords.length) instance.setView(position.current, 14);
    } else if (navigator.geolocation) watch = navigator.geolocation.watchPosition(p => { if (!alive) return; const first = !position.current; position.current = [p.coords.latitude, p.coords.longitude]; rider.setLatLng(position.current).addTo(instance); if (first) instance.setView(position.current, 16); }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
    setReady(true);
  }); return () => { alive = false; if (watch !== undefined) navigator.geolocation.clearWatch(watch); map.current?.remove(); map.current = null; }; }, []);
  useEffect(() => { if (!ready || !map.current) return; const current = map.current; let alive = true; let layer: import('leaflet').LayerGroup | undefined;
    import('leaflet').then(L => { if (!alive) return; layer = L.layerGroup().addTo(current); if (mapClean) return; const coords: [number, number][] = [];
      pedidos.forEach((p, i) => { const c = p.coordinates; if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return; coords.push([c.lat, c.lng]); const marker = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: `<div style="width:28px;height:28px;border-radius:10px;background:#276ce0;color:white;display:grid;place-items:center;font:bold 12px sans-serif;border:2px solid white;box-shadow:0 5px 12px #1235">${i + 1}</div>` }) }); marker.on('click', () => onOrderPress?.(Number(p.id))); marker.addTo(layer!); });
      if (coords.length > 1) L.polyline(coords, { color: '#4c91f6', weight: 3, dashArray: '6,6' }).addTo(layer!);
    }); return () => { alive = false; layer?.remove(); }; }, [ready, pedidos, mapClean, onOrderPress]);
  useEffect(() => { if (position.current && map.current) map.current.setView(position.current, routeMode ? 17 : 15); }, [recenterToken, routeMode]);
  // Os z-index internos do Leaflet pertencem ao mapa, abaixo dos controles do app.
  return <div ref={container} style={{ position: 'relative', zIndex: 0, isolation: 'isolate', width: '100%', height: '100%', background: dark ? '#19283f' : '#e8eff8', filter: dark ? 'brightness(.8)' : undefined }} />;
}
