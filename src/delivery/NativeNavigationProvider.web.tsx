import React from 'react';

// A navegação web abre Maps/Waze. O SDK do Google depende de views nativas
// e não pode entrar no bundle do navegador, mesmo dentro de um require condicional.
export function NativeNavigationProvider({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export const waitForNavigationReset = () => Promise.resolve();
export function waitForNavigationStop(work: Promise<void>) { void work.catch(() => undefined); }
