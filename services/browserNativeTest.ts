import { Linking, Platform } from 'react-native';

const environment = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
export const browserNativeTest =
  Platform.OS === 'web' &&
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  (environment === 'dev' || environment === 'development') &&
  process.env.EXPO_PUBLIC_BROWSER_MOCKS !== 'false';

let action =
  'GPS, camera, microfone e push simulados. Demais acoes usam a API.';
const listeners = new Set<() => void>();
const photos = new Set<string>();
export const browserMockProofPrefix = 'browser-mock-proof:';
export const isBrowserMockProof = (id?: string) =>
  !!id?.startsWith(browserMockProofPrefix);
export function assertRealProof(id?: string) {
  if (isBrowserMockProof(id))
    throw new Error(
      'MOCK no navegador: comprovante simulado apenas localmente. Escolha uma foto real para concluir no servidor; nenhuma entrega foi confirmada por este mock.',
    );
}
export const browserMockSnapshot = () => action;
export function subscribeBrowserMock(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reportBrowserMock(message: string) {
  if (!browserNativeTest) return;
  action = message;
  listeners.forEach((listener) => listener());
}
export const browserNativeLinking = {
  openURL: async (url: string) => {
    if (browserNativeTest) { reportBrowserMock('Discador MOCK no navegador. Nenhuma ligacao foi iniciada.'); return; }
    await Linking.openURL(url);
  },
};
export function isBrowserMockPhoto(base64: string) {
  return photos.has(base64);
}
export function assertRealPhoto(base64: string) {
  if (isBrowserMockPhoto(base64))
    throw new Error(
      'MOCK no navegador: foto simulada apenas para teste local; nao foi enviada ao servidor. Escolha um arquivo real para enviar.',
    );
}
export function createBrowserMockPhoto(): string {
  if (!browserNativeTest || typeof document === 'undefined')
    throw new Error(
      'Camera mock disponivel apenas no navegador de desenvolvimento.',
    );
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Nao foi possivel gerar a foto de teste.');
  context.fillStyle = '#e5edf8';
  context.fillRect(0, 0, 640, 480);
  context.fillStyle = '#306cdf';
  context.fillRect(170, 90, 300, 230);
  context.fillStyle = '#ffffff';
  context.font = 'bold 28px sans-serif';
  context.textAlign = 'center';
  context.fillText('FOTO MOCK', 320, 185);
  context.font = '20px sans-serif';
  context.fillText('Teste no navegador', 320, 230);
  context.fillStyle = '#18243a';
  context.fillText('Nao comprova uma entrega real', 320, 390);
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  photos.add(base64);
  reportBrowserMock(
    'Camera MOCK: foto gerada no navegador, sem acesso a camera.',
  );
  return base64;
}
