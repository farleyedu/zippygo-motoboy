import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setVisible(document.documentElement.dataset.zippyKeyboard === 'open');
      window.addEventListener('zippy-keyboard-change', update); update();
      return () => window.removeEventListener('zippy-keyboard-change', update);
    }
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}
