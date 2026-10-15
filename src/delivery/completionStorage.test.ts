import { describe, expect, it } from '@jest/globals';
import { deleteCompletionRecord, readCompletionRecord, writeCompletionRecord, type CompletionStorage } from './completionStorage';

function memory() {
  const data = new Map<string, string>();
  const storage: CompletionStorage = {
    getItemAsync: async key => data.get(key) ?? null,
    setItemAsync: async (key, value) => { data.set(key, value); },
    deleteItemAsync: async key => { data.delete(key); },
  };
  return { storage, data };
}
const big = (n: number) => JSON.stringify({ items: Array.from({ length: n }, (_, i) => ({ nome: `Produto ${i} 😀 ação`, valor: i })) });

describe('registro de conclusão em blocos pequenos (SecureStore)', () => {
  it('grava e relê um registro maior que o limite de um item, sem perder acentos nem emoji', async () => {
    const { storage, data } = memory(); const json = big(80);
    await writeCompletionRecord(storage, 'draft', json, 'r1');
    expect(await readCompletionRecord(storage, 'draft')).toBe(json);
    for (const [key, value] of data) if (key !== 'draft') expect(value.length).toBeLessThanOrEqual(450);
  });
  it('lê o formato antigo (JSON direto) sem migração destrutiva', async () => {
    const { storage } = memory(); await storage.setItemAsync('draft', '{"phase":"draft"}');
    expect(await readCompletionRecord(storage, 'draft')).toBe('{"phase":"draft"}');
  });
  it('troca de revisão remove os blocos antigos e mantém só os novos', async () => {
    const { storage, data } = memory();
    await writeCompletionRecord(storage, 'draft', big(80), 'r1');
    const newer = big(30); await writeCompletionRecord(storage, 'draft', newer, 'r2');
    expect(await readCompletionRecord(storage, 'draft')).toBe(newer);
    expect([...data.keys()].some(key => key.includes('.v2.r1.'))).toBe(false);
  });
  it('falha no meio da gravação preserva a versão anterior e não deixa blocos órfãos', async () => {
    const { storage, data } = memory(); const first = big(40);
    await writeCompletionRecord(storage, 'draft', first, 'r1');
    // Reaproveita o armazenamento com falha a partir da 3ª escrita.
    let calls = 0; const flaky: CompletionStorage = { ...storage, setItemAsync: async (k, v) => { if (++calls > 2) throw new Error('disco cheio'); await storage.setItemAsync(k, v); } };
    await expect(writeCompletionRecord(flaky, 'draft', big(80), 'r2')).rejects.toThrow('disco cheio');
    expect(await readCompletionRecord(storage, 'draft')).toBe(first);
    expect([...data.keys()].some(key => key.includes('.v2.r2.'))).toBe(false);
  });
  it('bloco ausente é erro explícito, nunca um registro parcial', async () => {
    const { storage, data } = memory(); await writeCompletionRecord(storage, 'draft', big(40), 'r1');
    data.delete([...data.keys()].find(key => key.endsWith('.1'))!);
    await expect(readCompletionRecord(storage, 'draft')).rejects.toThrow('incompleto');
  });
  it('ponteiro adulterado é recusado', async () => {
    const { storage } = memory(); await storage.setItemAsync('draft', JSON.stringify({ format: 2, revision: '../x', count: 3 }));
    await expect(readCompletionRecord(storage, 'draft')).rejects.toThrow('incompleto');
    await storage.setItemAsync('draft', JSON.stringify({ format: 2, revision: 'ok', count: 9999 }));
    await expect(readCompletionRecord(storage, 'draft')).rejects.toThrow('incompleto');
  });
  it('apagar remove o ponteiro e todos os blocos', async () => {
    const { storage, data } = memory(); await writeCompletionRecord(storage, 'draft', big(80), 'r1');
    await deleteCompletionRecord(storage, 'draft');
    expect(data.size).toBe(0); expect(await readCompletionRecord(storage, 'draft')).toBeNull();
  });
});
