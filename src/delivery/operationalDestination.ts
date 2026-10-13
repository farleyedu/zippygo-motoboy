import type { Href } from 'expo-router';
import type { MotoboyQueue } from '../../services/mobileApi';

export type OperationalStage = 'idle' | 'pickup' | 'route' | 'finish' | 'return';

export function operationalStage(queue: MotoboyQueue | null | undefined): OperationalStage {
  if (queue?.current) {
    if (!queue.current.pickedUpAtUtc) return 'pickup';
    return queue.current.arrivedAtUtc ? 'finish' : 'route';
  }
  if (queue?.next.length) return 'pickup';
  return queue?.routeState === 'returning' ? 'return' : 'idle';
}

export function canStartOperationalNavigation(queue: MotoboyQueue | null | undefined): boolean {
  // Depois de conferir a entrega ('finish') ainda é possível voltar ao modo rota, p. ex. se a chegada foi marcada antes da hora.
  return ['route', 'finish', 'return'].includes(operationalStage(queue));
}

export function canConcludeOperationalOrder(queue: MotoboyQueue | null | undefined, pedidoId: number): boolean {
  return operationalStage(queue) === 'finish' && queue?.current?.pedidoId === pedidoId;
}

// A fila confirmada autoriza a etapa, inclusive ao abrir um link ou voltar no histórico.
export function operationalPageRedirect(queue: MotoboyQueue, page: string, pedidoId: string | undefined, platform: string): Href | null {
  const stage = operationalStage(queue);
  const finalPages = ['confirmacaoEntrega', 'cobrarEntrega', 'dividirPagamento', 'comprovanteEntrega', 'clienteAusente'];
  if (finalPages.includes(page) && (stage !== 'finish' || pedidoId !== undefined && Number(pedidoId) !== queue.current?.pedidoId))
    return operationalDestination(queue, platform);
  // Retirada concluída: o mapa abre a escolha do navegador, em vez de cair no mapa sem perguntar.
  if (page === 'retirada' && stage === 'route') return { pathname: '/mapa', params: { navegar: 'escolher' } };
  if (page === 'retirada' && stage !== 'pickup' || page === 'retornoLoja' && stage !== 'return')
    return operationalDestination(queue, platform);
  return null;
}

// A navegação acompanha a tarefa; organizar a sequência é uma ação opcional.
export function operationalDestination(queue: MotoboyQueue | null | undefined, platform: string): Href {
  const stage = operationalStage(queue);
  if (stage === 'return') return '/retornoLoja';
  if (stage === 'finish') return { pathname: '/confirmacaoEntrega', params: { id: String(queue!.current!.pedidoId) } };
  if (stage === 'route') return { pathname: '/mapa', params: {} };
  if (stage === 'pickup') return '/retirada';
  return '/';
}

export function permissionIntent(value?: string): 'review' | 'start' | 'resume' {
  return value === 'start' || value === 'resume' ? value : 'review';
}

export function permissionReturn(value?: string): Href {
  return value && ['/', '/mapa', '/configuracoes', '/privacidade', '/somVibracao', '/ajudaOperacional'].includes(value)
    ? value as Href : '/';
}
