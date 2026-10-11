import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { browserNativeTest, reportBrowserMock } from './browserNativeTest';
import { googleMapsRoute, GOOGLE_MAPS_MAX_STOPS, GOOGLE_MAPS_BROWSER_MAX_STOPS, type ExternalStop } from '../src/delivery/externalRoute';

export async function openPreferredNavigation(destination: ExternalStop, app?: 'Google Maps' | 'Waze') {
  if (browserNativeTest) { reportBrowserMock('Navegacao externa MOCK no navegador. Maps/Waze nao foram abertos.'); return; }
  const hasCoords = typeof destination.latitude === 'number' && typeof destination.longitude === 'number' && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude) && Math.abs(destination.latitude)<=90 && Math.abs(destination.longitude)<=180;
  const target = hasCoords ? `${destination.latitude},${destination.longitude}` : destination.address?.trim();
  if (!target) throw new Error('Este destino não tem endereço ou coordenadas para navegar. Fale com a loja.');
  let preference: string = app || 'Google Maps';
  if (!app) try { const raw = await AsyncStorage.getItem('zippygo.design.preferences.v1'); if (raw) preference = JSON.parse(raw).navigationApp || preference; } catch { /* Usa Maps. */ }
  if (preference === 'Waze') {
    const query = `${hasCoords ? 'll' : 'q'}=${encodeURIComponent(target)}&navigate=yes`;
    const native = `waze://?${query}`;
    if (Platform.OS !== 'web') try { if (await Linking.canOpenURL(native)) { await Linking.openURL(native); return; } } catch { /* Link web como alternativa. */ }
    await Linking.openURL(`https://waze.com/ul?${query}`); return;
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=two-wheeler&dir_action=navigate`);
}

// Envia a rota inteira, na ordem do app, ao Google Maps. Retorna quantas paradas foram enviadas.
export async function openGoogleMapsRoute(stops: ExternalStop[]) {
  let maxStops = GOOGLE_MAPS_BROWSER_MAX_STOPS;
  if (Platform.OS !== 'web' && !browserNativeTest) {
    const probe = Platform.OS === 'android' ? 'google.navigation:q=0,0' : 'comgooglemaps://';
    try { if (await Linking.canOpenURL(probe)) maxStops = GOOGLE_MAPS_MAX_STOPS; } catch { /* Limite seguro do navegador móvel. */ }
  }
  const route = googleMapsRoute(stops, maxStops);
  if (!route) throw new Error('Estas paradas não têm endereço ou coordenadas para navegar. Fale com a loja.');
  if (browserNativeTest) { reportBrowserMock('Rota no Google Maps MOCK no navegador. O Maps nao foi aberto.'); return route; }
  await Linking.openURL(route.url);
  return route;
}
