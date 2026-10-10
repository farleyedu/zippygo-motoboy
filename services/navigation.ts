import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { browserNativeTest, reportBrowserMock } from './browserNativeTest';
import { googleMapsRoute, type ExternalStop } from '../src/delivery/externalRoute';

export async function openPreferredNavigation(destination: ExternalStop, app?: 'Google Maps' | 'Waze') {
  if (browserNativeTest) { reportBrowserMock('Navegacao externa MOCK no navegador. Maps/Waze nao foram abertos.'); return; }
  const hasCoords = typeof destination.latitude === 'number' && typeof destination.longitude === 'number' && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude) && Math.abs(destination.latitude)<=90 && Math.abs(destination.longitude)<=180;
  const target = hasCoords ? `${destination.latitude},${destination.longitude}` : destination.address?.trim();
  if (!target) throw new Error('Este destino não tem endereço ou coordenadas para navegar. Fale com a loja.');
  let preference: string = app || 'Google Maps';
  if (!app) try { const raw = await AsyncStorage.getItem('zippygo.design.preferences.v1'); if (raw) preference = JSON.parse(raw).navigationApp || preference; } catch { /* Usa Maps. */ }
  if (preference === 'Waze' && hasCoords) {
    const native = `waze://?ll=${encodeURIComponent(target)}&navigate=yes`;
    try { if (await Linking.canOpenURL(native)) { await Linking.openURL(native); return; } } catch { /* Link web como alternativa. */ }
    await Linking.openURL(`https://waze.com/ul?ll=${encodeURIComponent(target)}&navigate=yes`); return;
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving`);
}

// Envia a rota inteira, na ordem do app, ao Google Maps. Retorna quantas paradas foram enviadas.
export async function openGoogleMapsRoute(stops: ExternalStop[]) {
  const route = googleMapsRoute(stops);
  if (!route) throw new Error('Estas paradas não têm endereço ou coordenadas para navegar. Fale com a loja.');
  if (browserNativeTest) { reportBrowserMock('Rota no Google Maps MOCK no navegador. O Maps nao foi aberto.'); return route; }
  await Linking.openURL(route.url);
  return route;
}
