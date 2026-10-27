import { deleteWebDraft, readWebDraft, writeWebDraft, type WebDraftStore } from './webDraftStorage';
import { inactivityRemainingLabel } from '../session/inactivity';

const memory = (over: Partial<WebDraftStore> = {}): WebDraftStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); }, ...over };
};

describe('rascunho de conclusão na Web', () => {
  it('grava no armazenamento durável e apaga a cópia da sessão', () => {
    const durable = memory(), session = memory(); session.data.set('k', 'velho');
    writeWebDraft('k', 'novo', { durable, session });
    expect(durable.data.get('k')).toBe('novo');
    expect(session.data.has('k')).toBe(false);
  });
  it('lê o durável primeiro e ainda lê rascunhos antigos da sessão', () => {
    const durable = memory(), session = memory();
    session.data.set('k', 'legado');
    expect(readWebDraft('k', { durable, session })).toBe('legado');
    durable.data.set('k', 'atual');
    expect(readWebDraft('k', { durable, session })).toBe('atual');
  });
  it('cota ou modo privado: cai para a sessão em vez de perder a conferência', () => {
    const durable = memory({ setItem: () => { throw new Error('quota'); } }), session = memory();
    writeWebDraft('k', 'v', { durable, session });
    expect(session.data.get('k')).toBe('v');
  });
  it('sem nenhum armazenamento falha de forma explícita', () => {
    expect(() => writeWebDraft('k', 'v', { durable: null, session: null })).toThrow(/não permite guardar/);
  });
  it('apagar remove das duas camadas', () => {
    const durable = memory(), session = memory();
    durable.data.set('k', 'a'); session.data.set('k', 'b');
    deleteWebDraft('k', { durable, session });
    expect(readWebDraft('k', { durable, session })).toBeNull();
  });
});

describe('prazo de inatividade', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  it('mostra horas e minutos restantes informados pelo servidor', () => {
    expect(inactivityRemainingLabel('2026-01-01T16:12:00Z', now)).toMatch(/6 h 12 min/);
  });
  it('sem prazo do servidor não inventa um', () => {
    expect(inactivityRemainingLabel(null, now)).toBeNull();
    expect(inactivityRemainingLabel('lixo', now)).toBeNull();
  });
});
