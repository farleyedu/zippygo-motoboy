import type { RouteStop } from '../../services/mobileApi';
import { payModes } from '../../services/workApi';

export function offerTotal(stops: RouteStop[]): number | null {
  if (!stops.length || !stops.every(s => s.earnings && ['delivery', 'distance'].includes(s.earnings.mode) && s.earnings.amount != null)) return null;
  return stops.reduce((sum, s) => sum + Math.round(s.earnings!.amount! * 100), 0) / 100;
}
export function stopNavigationAddress(stop: RouteStop): string | undefined {
  return stop.pedido?.enderecoEntrega?.trim() || [stop.pedido?.rua, stop.pedido?.numero, stop.pedido?.bairro, stop.pedido?.cidade, stop.pedido?.estado, stop.pedido?.cep].filter(Boolean).join(', ') || undefined;
}
export function stopAddress(stop: RouteStop): string {
  return stopNavigationAddress(stop) || 'Endereço não informado · confira com a loja';
}
export function stopEarnings(stop: RouteStop, format: (amount?: number | null) => string): string {
  if (!stop.earnings) return 'Ganho não informado';
  return ['delivery', 'distance'].includes(stop.earnings.mode)
    ? format(stop.earnings.amount) : `${format(stop.earnings.rate)} ${payModes[stop.earnings.mode]}`;
}
