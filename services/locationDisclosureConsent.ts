import { Platform } from 'react-native';
import { getSecureItem, secureStorage } from '../utils/secureStorage';
import { expoGo } from './expoGo';

export const LOCATION_DISCLOSURE_VERSION = 1;
export const LOCATION_DISCLOSURE_KEY = 'zippyboy.locationDisclosureConsent';
export const LOCATION_DISCLOSURE_TITLE = 'Localização durante seu turno';
export const LOCATION_DISCLOSURE_TEXT = 'O ZippyBoy coleta sua localização durante o turno online para que o estabelecimento acompanhe sua posição no mapa e seu deslocamento nas entregas, mesmo quando o app está em segundo plano ou a tela está apagada. A coleta termina ao encerrar o turno.';

export function requiresLocationDisclosure(): boolean {
  return Platform.OS === 'android' && !expoGo;
}

async function currentUserId(): Promise<string | null> {
  try {
    const raw = await getSecureItem('zippygo.user');
    const user = raw ? JSON.parse(raw) as { id?: string | number } : null;
    return user?.id != null && String(user.id) ? String(user.id) : null;
  } catch { return null; }
}

export async function hasLocationDisclosureConsent(): Promise<boolean> {
  if (!requiresLocationDisclosure()) return true;
  const userId = await currentUserId();
  if (!userId) return false;
  try {
    const raw = await getSecureItem(LOCATION_DISCLOSURE_KEY);
    const consent = raw ? JSON.parse(raw) as { version?: number; userId?: string; acceptedAtUtc?: string } : null;
    return consent?.version === LOCATION_DISCLOSURE_VERSION && consent.userId === userId
      && typeof consent.acceptedAtUtc === 'string' && Number.isFinite(Date.parse(consent.acceptedAtUtc))
      && await currentUserId() === userId;
  } catch { return false; }
}

// Só a ação afirmativa do diálogo chama esta função. Falha de persistência
// precisa chegar à tela: consentimento não pode ser presumido após erro de disco.
export async function acceptLocationDisclosure(expectedUserId: string): Promise<void> {
  if (!requiresLocationDisclosure()) return;
  if (await currentUserId() !== expectedUserId) throw new Error('Seu acesso mudou. Confira a conta antes de continuar.');
  try {
    await secureStorage.setItemAsync(LOCATION_DISCLOSURE_KEY, JSON.stringify({
      version: LOCATION_DISCLOSURE_VERSION, userId: expectedUserId, acceptedAtUtc: new Date().toISOString(),
    }));
  } catch { throw new Error('Não foi possível salvar seu consentimento. Tente novamente.'); }
  if (await currentUserId() !== expectedUserId || !(await hasLocationDisclosureConsent()))
    throw new Error('Não foi possível confirmar o consentimento neste acesso. Tente novamente.');
}
