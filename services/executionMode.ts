import { Platform } from 'react-native';

/** native = app Android/iOS; web-installed = PWA na tela inicial; web-browser = aba comum do navegador. */
export type ExecutionMode = 'native' | 'web-installed' | 'web-browser';
export type ExecutionEnvironment = {
  os: string;
  standalone?: boolean;
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

/** iPadOS 13+ se identifica como Mac; só o suporte a toque o diferencia. */
export function isIosDevice(env: Pick<ExecutionEnvironment, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPhone|iPad|iPod/i.test(env.userAgent ?? '')) return true;
  return env.platform === 'MacIntel' && (env.maxTouchPoints ?? 0) > 1;
}

export function resolveExecutionMode(env: ExecutionEnvironment): ExecutionMode {
  if (env.os !== 'web') return 'native';
  return env.standalone ? 'web-installed' : 'web-browser';
}

export function readExecutionEnvironment(): ExecutionEnvironment {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { os: Platform.OS };
  const nav = window.navigator as Navigator & { standalone?: boolean };
  let standalone = nav.standalone === true;
  try {
    standalone ||= ['standalone', 'fullscreen', 'minimal-ui'].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
  } catch { /* matchMedia indisponível: trata como aba comum. */ }
  return { os: 'web', standalone, userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints };
}

export function executionMode(): ExecutionMode {
  return resolveExecutionMode(readExecutionEnvironment());
}

export function isIosWeb(): boolean {
  const env = readExecutionEnvironment();
  return env.os === 'web' && isIosDevice(env);
}
