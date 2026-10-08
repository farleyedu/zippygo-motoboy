import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function openPreferredNavigation(destination: { latitude?: number | null; longitude?: number | null; address?: string | null }) {
  const hasCoords = typeof destination.latitude === 'number' && typeof destination.longitude === 'number' && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude) && Math.abs(destination.latitude)<=90 && Math.abs(destination.longitude)<=180;
  const target = hasCoords ? `${destination.latitude},${destination.longitude}` : destination.address?.trim();
  if (!target) throw new Error('Este destino não tem endereço ou coordenadas para navegar. Fale com a loja.');
  let preference = 'Google Maps';
  try { const raw = await AsyncStorage.getItem('zippygo.design.preferences.v1'); if (raw) preference = JSON.parse(raw).navigationApp || preference; } catch { /* Usa Maps. */ }
  if (preference === 'Waze' && hasCoords) {
    const native = `waze://?ll=${encodeURIComponent(target)}&navigate=yes`;
    try { if (await Linking.canOpenURL(native)) { await Linking.openURL(native); return; } } catch { /* Link web como alternativa. */ }
    await Linking.openURL(`https://waze.com/ul?ll=${encodeURIComponent(target)}&navigate=yes`); return;
  }
  await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving`);
}
