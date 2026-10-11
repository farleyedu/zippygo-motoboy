import type { Href } from 'expo-router';
import type { MotoboyQueue } from '../../services/mobileApi';

// A navegação acompanha a tarefa; organizar a sequência é uma ação opcional.
export function operationalDestination(queue: MotoboyQueue | null | undefined, platform: string): Href {
  if (queue?.routeState === 'returning') return '/retornoLoja';
  if (queue?.current?.pickedUpAtUtc && queue.current.arrivedAtUtc) return { pathname: '/confirmacaoEntrega', params: { id: String(queue.current.pedidoId) } };
  if (queue?.current?.pickedUpAtUtc) return { pathname: '/mapa', params: {} };
  if (queue?.current || queue?.next.length) return '/retirada';
  return '/';
}

export function permissionIntent(value?: string): 'review' | 'start' | 'resume' {
  return value === 'start' || value === 'resume' ? value : 'review';
}

export function permissionReturn(value?: string): Href {
  return value && ['/', '/mapa', '/configuracoes', '/privacidade', '/somVibracao', '/ajudaOperacional'].includes(value)
    ? value as Href : '/';
}
