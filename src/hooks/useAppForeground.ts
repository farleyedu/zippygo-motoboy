import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

export function isAppForeground() {
  return Platform.OS === 'web'
    ? typeof document !== 'undefined' && document.visibilityState === 'visible'
    : AppState.currentState === 'active';
}

export function useAppForeground() {
  const [active, setActive] = useState(isAppForeground);
  useEffect(() => {
    const update = () => setActive(isAppForeground());
    const state = AppState.addEventListener('change', update);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', update);
    update();
    return () => {
      state.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return active;
}
