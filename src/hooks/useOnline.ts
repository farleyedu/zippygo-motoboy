import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Conectividade do navegador. No app nativo não há sinal confiável sem biblioteca extra; a fase do turno cobre o caso. */
export function useOnline(): boolean {
  const read = () => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine !== false;
  const [online, setOnline] = useState(read);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setOnline(read());
    window.addEventListener('online', update); window.addEventListener('offline', update);
    update();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}
