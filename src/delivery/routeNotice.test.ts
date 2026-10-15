import { describe, expect, it } from '@jest/globals';
import { routeNoticeKind } from './routeNotice';

describe('aviso de rota por ação em tempo real', () => {
  it('cancelamentos próprios e oficiais do iFood avisam que a loja cancelou', () => {
    for (const action of ['canceled', 'auto_closed', 'ifood_canceled']) expect(routeNoticeKind(action)).toBe('cancelled');
  });
  it('mudanças de rota, inclusive conclusão e atualização do iFood, avisam que a rota mudou', () => {
    for (const action of ['assigned', 'reordered', 'transferred', 'transfer_completed', 'ifood_closed', 'ifood_updated']) expect(routeNoticeKind(action)).toBe('changed');
  });
  it('ação desconhecida ou vazia não gera aviso', () => {
    for (const action of ['ifood_projected', 'qualquer', '', undefined, null]) expect(routeNoticeKind(action as never)).toBeNull();
  });
});
