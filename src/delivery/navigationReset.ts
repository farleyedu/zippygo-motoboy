let reset = Promise.resolve();
export async function waitForNavigationReset(): Promise<void> {
  // Ler depois que os efeitos do provedor registrarem a limpeza deste turno.
  await Promise.resolve();
  await reset;
}
export function queueNavigationReset(work: () => Promise<void>): void {
  reset = reset.catch(() => {}).then(work);
}
export function waitForNavigationStop(work: Promise<void>): void {
  reset = Promise.all([reset.catch(() => {}), work.catch(() => {})]).then(() => {});
}
