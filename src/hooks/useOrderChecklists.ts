import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { checklistItems, checklistReady, itemSignature, type ChecklistOrder } from '../delivery/checklistRules';

type Checks = Record<string, { picked: Record<string, string>; extras: Record<string, string> }>;
export function useOrderChecklists(orders: ChecklistOrder[], stage: 'pickup' | 'delivery') {
  const auth = useAuth();
  const store = auth.estabelecimentoAtual;
  const storeId = store ? ('id' in store ? store.id : store.estabelecimentoId) : '';
  const scope = String(auth.user?.id || '') + ':' + String(storeId) + ':' + stage;
  const key = 'zippygo.item-checks.v1:' + scope;
  const [checks, setChecks] = useState<Checks>({}), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const current = useRef<Checks>({}), generation = useRef(0), writes = useRef(Promise.resolve());
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
    if (loading) return;
    const item = checklistItems(order.checklist).find(i => i.key === itemKey); if (!item) return;
    const run = generation.current;
    // Serializa as gravações para que toques rápidos não percam marcações.
    const write = writes.current.catch(() => {}).then(async () => {
      if (run !== generation.current) return;
      const saved = current.current[String(order.id)] || { picked: {}, extras: {} };
      const field = extra ? 'extras' : 'picked', nextField = { ...saved[field] }, signature = itemSignature(item);
      if (nextField[itemKey] === signature) delete nextField[itemKey]; else nextField[itemKey] = signature;
      const next = { ...current.current, [order.id]: { ...saved, [field]: nextField, ...(!extra ? { extras: {} } : {}) } };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      if (run === generation.current) { current.current = next; setChecks(next); setError(''); }
    });
    writes.current = write;
    try { await write; } catch { setError('Não foi possível salvar a marcação. Confira novamente este item.'); }
  };
  const confirmations = orders.map(order => {
    const items = checklistItems(order.checklist), saved = checks[String(order.id)];
    return { pedidoId: order.id, version: order.checklist.version,
      confirmedKeys: items.filter(i => saved?.picked?.[i.key] === itemSignature(i)).map(i => i.key),
      recheckedExtraKeys: items.filter(i => i.extra && saved?.extras?.[i.key] === itemSignature(i)).map(i => i.key) };
  });
  const primaryReady = !loading && !error && !!orders.length && orders.every((o, i) => confirmations[i].confirmedKeys.length === checklistItems(o.checklist).length);
  const ready = primaryReady && orders.every((o, i) => checklistReady(o.checklist, confirmations[i]));
  return { loading, error, confirmations, primaryReady, ready, toggle };
}
