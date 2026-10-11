export const mapPinMetrics = { width: 44, height: 54, tipX: 22, tipY: 50 } as const;
const badge = 'M15 3H29Q41 3 41 15V29Q41 39 30 39H29L22 50L15 39H14Q3 39 3 29V15Q3 3 15 3Z';
// A ponta é a coordenada real. O número é texto; não há PNG por parada.
export function mapPinSvg(number: number, highlighted: boolean) {
  const label = Number.isSafeInteger(number) && number > 0 && number <= 99999 ? String(number) : '?';
  const id = `route-pin-${label}-${highlighted ? 'active' : 'future'}`;
  const top = highlighted ? '#438cf4' : '#8191a4', bottom = highlighted ? '#1855bd' : '#495b72';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><ellipse cx="22" cy="51" rx="9" ry="2" fill="#10294e30"/><path d="${badge}" transform="translate(0 2)" fill="${highlighted ? '#0f3779' : '#2e3d51'}"/><path d="${badge}" fill="url(#${id})" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 7H31" stroke="#ffffff55" stroke-width="2" stroke-linecap="round"/><text x="22" y="28" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${label.length > 3 ? 11 : label.length > 2 ? 16 : 22}" fill="#ffffff">${label}</text></svg>`;
}
