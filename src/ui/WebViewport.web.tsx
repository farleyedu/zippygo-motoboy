import { useEffect } from 'react';

// O teclado reduz a área visível; a largura e a escala do app permanecem intactas.
export function WebViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let fullHeight = Math.max(window.innerHeight, viewport.height), frame = 0, open = false;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Zoom feito pelo usuário continua disponível e não vira tamanho de layout.
        if (viewport.scale !== 1) return;
        const focused = document.activeElement;
        const editing = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || focused instanceof HTMLSelectElement;
        if (!editing) fullHeight = Math.max(window.innerHeight, viewport.height);
        const next = editing && fullHeight - viewport.height > 100;
        if (next) {
          root.style.setProperty('--zippy-visible-height', `${viewport.height}px`);
          root.style.setProperty('--zippy-visible-top', `${viewport.offsetTop}px`);
          if (!open && focused instanceof HTMLElement) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          root.style.removeProperty('--zippy-visible-height');
          root.style.removeProperty('--zippy-visible-top');
        }
        if (open !== next) {
          open = next; root.dataset.zippyKeyboard = next ? 'open' : 'closed';
          window.dispatchEvent(new Event('zippy-keyboard-change'));
        }
      });
    };
    const orientation = () => { fullHeight = window.innerHeight; update(); };
    viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    window.addEventListener('resize', update); window.addEventListener('orientationchange', orientation); update();
    return () => {
      cancelAnimationFrame(frame); viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
      window.removeEventListener('resize', update); window.removeEventListener('orientationchange', orientation);
      root.style.removeProperty('--zippy-visible-height'); root.style.removeProperty('--zippy-visible-top'); delete root.dataset.zippyKeyboard;
    };
  }, []);
  return null;
}
