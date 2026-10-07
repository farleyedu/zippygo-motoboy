import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const palettes = {
  light: { paper: '#f6f8fc', card: '#ffffff', ink: '#18243a', muted: '#6c7b92', line: '#e0e7f3', soft: '#edf2fc', accent: '#306cdf', accentSoft: '#dfeaff', hero: '#14243e', heroEnd: '#274367', heroInk: '#f4f8ff', heroMuted: '#bed0eb', warning: '#aa7237', warningSoft: '#f8efdf', danger: '#c25043', dangerSoft: '#fbece8', success: '#208456' },
  dark: { paper: '#10192b', card: '#1b2941', ink: '#f1f6ff', muted: '#b1c1d8', line: '#354a69', soft: '#263a57', accent: '#92bcff', accentSoft: '#2d4b76', hero: '#14243f', heroEnd: '#244165', heroInk: '#f4f8ff', heroMuted: '#bed0eb', warning: '#f3cf9e', warningSoft: '#3b3028', danger: '#ffb9a8', dangerSoft: '#49312f', success: '#79d9ac' },
};
export type ThemeColors = { [K in keyof typeof palettes.light]: string };
// Medidas compartilhadas pelo novo visual, sem alterar as telas legadas.
export const layout = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, section: 32 },
  radius: { field: 13, button: 15, card: 20, hero: 23 },
  touch: 44,
  contentWidth: 480,
  motion: { entrance: 320, press: 140 },
} as const;
type Preferences = { dark: boolean; reducedMotion: boolean; sound: boolean; vibration: boolean };
type ThemeContextValue = Preferences & { colors: ThemeColors; setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const key = 'zippygo.design.preferences.v1';
const defaults: Preferences = { dark: false, reducedMotion: false, sound: true, vibration: true };

export function ZippyThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key).then(raw => {
      if (!raw || !alive) return;
      try { const saved = JSON.parse(raw) as Partial<Preferences>; setPreferences(p => ({ ...p, ...Object.fromEntries(Object.entries(saved).filter(([k, v]) => k in defaults && typeof v === 'boolean')) })); } catch { /* Preferências inválidas usam os padrões. */ }
    }).catch(() => { /* Mantém as preferências padrão se o armazenamento estiver indisponível. */ });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setSystemReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    return () => { alive = false; listener.remove(); };
  }, []);
  const value = useMemo<ThemeContextValue>(() => ({
    ...preferences, reducedMotion: preferences.reducedMotion || systemReduced,
    colors: preferences.dark ? palettes.dark : palettes.light,
    setPreference: async (name, setting) => {
      const next = { ...preferences, [name]: setting };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      setPreferences(next);
    },
  }), [preferences, systemReduced]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useZippyTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('A tela deve estar dentro de ZippyThemeProvider.');
  return context;
}
