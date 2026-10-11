import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { checklistItems, checklistReady, itemSignature, type ChecklistOrder, type ChecklistConfirmation } from '../delivery/checklistRules';

type Checks = Record<string, { picked: Record<string, string>; extras: Record<string, string> }>;
export function useOrderChecklists(orders: ChecklistOrder[], stage: 'pickup' | 'delivery') {
  const auth = useAuth();
  const store = auth.estabelecimentoAtual;
  const storeId = store ? ('id' in store ? store.id : store.estabelecimentoId) : '';
  const scope = String(auth.user?.id || '') + ':' + String(storeId) + ':' + stage;
  const key = 'zippygo.item-checks.v1:' + scope;
  const [checks, setChecks] = useState<Checks>({}), [loading, setLoading] = useState(true), [writing, setWriting] = useState(false), [error, setError] = useState('');
  const current = useRef<Checks>({}), generation = useRef(0), writes = useRef(Promise.resolve()), pendingWrites = useRef(0);
  useFocusEffect(useCallback(() => {
    const run = ++generation.current; setLoading(true); setError(''); current.current = {}; setChecks({});
    AsyncStorage.getItem(key).then(raw => {
      if (run !== generation.current) return;
      const value = raw ? JSON.parse(raw) as Checks : {};
      current.current = value; setChecks(value);
    }).catch(() => { if (run === generation.current) setError('Não foi possível recuperar a conferência. Tente novamente antes de sair.'); })
      .finally(() => { if (run === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [key]));
  const toggle = async (order: ChecklistOrder, itemKey: string, extra = false) => {
    return toggleItems(order, [itemKey], extra);
  };
  const toggleBag = async (order: ChecklistOrder) => toggleItems(order, checklistItems(order.checklist).filter(item => !item.extra).map(item => item.key));
  const toggleItems = async (order: ChecklistOrder, itemKeys: string[], extra = false) => {
    if (loading) return;
    const items = checklistItems(order.checklist).filter(i => itemKeys.includes(i.key)); if (!items.length) return;
    pendingWrites.current++; setWriting(true);
    const run = generation.current;
    // Serializa as gravações para que toques rápidos não percam marcações.
    const write = writes.current.catch(() => {}).then(async () => {
      if (run !== generation.current) return;
      const saved = current.current[String(order.id)] || { picked: {}, extras: {} };
      const field = extra ? 'extras' : 'picked', nextField = { ...saved[field] };
      const alreadyChecked = items.every(item => nextField[item.key] === itemSignature(item));
      for (const item of items) { if (alreadyChecked) delete nextField[item.key]; else nextField[item.key] = itemSignature(item); }
      const next = { ...current.current, [order.id]: { ...saved, [field]: nextField, ...(!extra ? { extras: {} } : {}) } };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (run === generation.current) { current.current = next; setChecks(next); setError(''); }
    });
    writes.current = write;
    try { await write; } catch { if (run === generation.current) setError('Não foi possível salvar a marcação. Confira novamente este item.'); }
    finally { pendingWrites.current--; setWriting(pendingWrites.current > 0); }
  };
  const confirmationsFor = (savedChecks: Checks): ChecklistConfirmation[] => orders.map(order => {
    const items = checklistItems(order.checklist), saved = savedChecks[String(order.id)];
    return { pedidoId: order.id, version: order.checklist.version,
      confirmedKeys: items.filter(i => saved?.picked?.[i.key] === itemSignature(i)).map(i => i.key),
      recheckedExtraKeys: items.filter(i => i.extra && saved?.extras?.[i.key] === itemSignature(i)).map(i => i.key) };
  });
  const confirmations = confirmationsFor(checks);
  const confirmExtras = async (): Promise<ChecklistConfirmation[] | null> => {
    if (loading || !orders.length) return null;
    const run = generation.current;
    const write = writes.current.catch(() => {}).then(async () => {
      if (run !== generation.current) throw new Error('Sua conferência mudou. Confira o pedido atual.');
      const next = { ...current.current };
      for (const order of orders) {
        const saved = next[String(order.id)];
        if (!saved) throw new Error('Confira os itens antes de confirmar a saída.');
        next[String(order.id)] = { ...saved, extras: Object.fromEntries(checklistItems(order.checklist).filter(i => i.extra).map(i => [i.key, itemSignature(i)])) };
      }
      const result = confirmationsFor(next);
      if (!orders.every((order, i) => checklistReady(order.checklist, result[i]))) throw new Error('Os itens mudaram. Confira as quantidades novamente.');
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (run !== generation.current) throw new Error('Sua conferência mudou. Volte ao pedido atual.');
      current.current = next; setChecks(next); setError('');
      return result;
    });
    writes.current = write.then(() => {}, () => {});
    try { return await write; } catch (failure) { if (run === generation.current) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar a conferência.'); return null; }
  };
  const primaryReady = !loading && !writing && !error && !!orders.length && orders.every((o, i) => confirmations[i].confirmedKeys.length === checklistItems(o.checklist).length);
  const ready = primaryReady && orders.every((o, i) => checklistReady(o.checklist, confirmations[i]));
  return { loading: loading || writing, error, confirmations, primaryReady, ready, toggle, toggleBag, confirmExtras };
}
