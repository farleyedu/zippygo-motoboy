import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { Pedido } from '../types/pedido';
import { useZippyTheme } from '../src/ui/theme';
import 'leaflet/dist/leaflet.css';
import { browserNativeTest } from '../services/browserNativeTest';
import type { MapaProps } from './mapTypes';
import { mapPinSvg } from '../src/delivery/mapPin';
import { validMapCoordinate } from '../src/delivery/mapPreview';

export default function Mapa({ pedidos, mapClean, onOrderPress, recenterToken, routeMode, routePreview, overviewToken, selectedPedidoId, navigationBottomInset, path, pathSegments, pathDashed, collectionDestination }: MapaProps) {
  const { dark } = useZippyTheme(), container = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), [ready, setReady] = useState(false);
  const position = useRef<[number, number] | null>(null);
  const segments = pathSegments || (path?.length ? [path] : []);
  const pathKey = segments.map(segment => segment.map(p => p.lat + ':' + p.lng).join('|')).join('/');
  const storeKey = collectionDestination?.lat + ':' + collectionDestination?.lng;
  useEffect(() => { let alive = true; let watch: number | undefined; import('leaflet').then(L => {
    if (!alive || !container.current) return;
    const instance = L.map(container.current, { zoomControl: false, attributionControl: true }); map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(instance);
    const coords = pedidos.map(p => p.coordinates).filter((c): c is { lat: number; lng: number } => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (coords.length) instance.fitBounds(coords.map(c => [c.lat, c.lng]), { paddingTopLeft: [25, 60], paddingBottomRight: [25, 65], maxZoom: 15 }); else instance.setView([0, 0], 2);
    const rider = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 3, fillColor: '#397df0', fillOpacity: 1 });
    if (browserNativeTest) {
      position.current = coords.length ? [coords[0].lat + 0.002, coords[0].lng + 0.002] : [-23.5505, -46.6333];
      rider.setLatLng(position.current).bindTooltip('GPS MOCK no navegador').addTo(instance);
      if (!coords.length) instance.setView(position.current, 14);
    } else if (navigator.geolocation) watch = navigator.geolocation.watchPosition(p => { if (!alive) return; const first = !position.current; position.current = [p.coords.latitude, p.coords.longitude]; rider.setLatLng(position.current).addTo(instance); if (first && !coords.length) instance.setView(position.current, 16); }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
    setReady(true);
  }); return () => { alive = false; if (watch !== undefined) navigator.geolocation.clearWatch(watch); map.current?.remove(); map.current = null; }; }, []);
  useEffect(() => { if (!ready || !map.current) return; const current = map.current; let alive = true; let layer: import('leaflet').LayerGroup | undefined;
    import('leaflet').then(L => { if (!alive) return; layer = L.layerGroup().addTo(current); if (mapClean) return; const coords: [number, number][] = [];
      pedidos.forEach((p, i) => { const c = p.coordinates; if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return; coords.push([c.lat, c.lng]); const active = i === 0 || p.id === selectedPedidoId, scale = active ? 1 : .8; const marker = L.marker([c.lat, c.lng], { title: `Pedido ${p.id}, parada ${i + 1}`, zIndexOffset: active ? 1000 : 0, icon: L.divIcon({ className: '', html: `<div style="width:44px;height:54px;transform:scale(${scale});transform-origin:top left">${mapPinSvg(i + 1, active)}</div>`, iconSize: [44 * scale, 54 * scale], iconAnchor: [22 * scale, 50 * scale] }) }); marker.on('click', () => onOrderPress?.(Number(p.id))); marker.addTo(layer!); });
      if (validMapCoordinate(collectionDestination)) L.marker([collectionDestination.lat, collectionDestination.lng], { title: 'Coleta no estabelecimento', icon: L.divIcon({ className: '', html: '<div style="width:30px;height:30px;border-radius:10px;background:#b48a60;color:#fff;border:2px solid #fff;box-shadow:0 3px 8px #0005;display:grid;place-items:center;font-size:19px">⌂</div>', iconSize: [34, 34], iconAnchor: [17, 34] }) }).addTo(layer!);
      const paths = pathSegments || (path?.length ? [path] : [pedidos.map(p => p.coordinates).filter(validMapCoordinate)]);
      for (const segment of paths) if (segment.length > 1) L.polyline(segment.map(p => [p.lat, p.lng]), { color: '#4c91f6', weight: 3, dashArray: pathDashed || (!pathSegments && !path) ? '8,6' : undefined }).addTo(layer!);
    }); return () => { alive = false; layer?.remove(); }; }, [ready, pedidos, mapClean, onOrderPress, selectedPedidoId, pathKey, pathDashed, storeKey]);
  useEffect(() => {
    if (!ready || !map.current || !routePreview) return;
    const current = map.current;
    const coords = pedidos.filter(p => p.coordinates && Number.isFinite(p.coordinates.lat) && Number.isFinite(p.coordinates.lng));
    const selected = coords.find(p => p.id === selectedPedidoId);
    if (selected?.coordinates) {
      const c = selected.coordinates;
      const point = current.project([c.lat, c.lng], 16);
      point.y += (navigationBottomInset || 0) / 2;
      current.setView(current.unproject(point, 16), 16, { animate: false });
    } else {
      const points = [...segments.flat(), ...coords.map(p => p.coordinates), collectionDestination].filter(validMapCoordinate);
      if (points.length) current.fitBounds(points.map(p => [p.lat, p.lng] as [number, number]), { paddingTopLeft: [35, 85], paddingBottomRight: [35, (navigationBottomInset || 0) + 60], maxZoom: 15, animate: false });
    }
  }, [ready, routePreview, overviewToken, selectedPedidoId, navigationBottomInset, pedidos, pathKey, storeKey]);
  useEffect(() => { if (position.current && map.current) map.current.setView(position.current, routeMode ? 17 : 15); }, [recenterToken, routeMode]);
  // Os z-index internos do Leaflet pertencem ao mapa, abaixo dos controles do app.
  return <div ref={container} style={{ position: 'relative', zIndex: 0, isolation: 'isolate', width: '100%', height: '100%', background: dark ? '#19283f' : '#e8eff8', filter: dark ? 'brightness(.8)' : undefined }} />;
}
