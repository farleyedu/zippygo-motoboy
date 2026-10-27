/** Texto do prazo de inatividade. O instante vem do servidor; sem ele o app não inventa um prazo. */
export function inactivityRemainingLabel(expiresAtUtc: string | null | undefined, now = Date.now()): string | null {
  if (!expiresAtUtc) return null;
  const expires = Date.parse(expiresAtUtc);
  if (!Number.isFinite(expires)) return null;
  const minutes = Math.floor((expires - now) / 60000);
  if (minutes <= 0) return 'O turno pode ser encerrado a qualquer momento por inatividade.';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  const span = hours > 0 ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
  return `Encerra sozinho em ${span} se o app não for usado. Qualquer toque seu renova o prazo.`;
}
