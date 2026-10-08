import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { type, Feedback, money, Surface } from './Kit';
import { useZippyTheme } from './theme';
import { payModes, type WorkEntry, type WorkPeriod } from '../../services/workApi';

/** Explica de onde veio o valor de um lançamento por período (dia/semana/quinzena/mês), sem deixar dúvida:
 *  mostra o valor do período completo, o equivalente por dia e quanto foi efetivamente trabalhado. */
export function periodBreakdown(entry: WorkEntry): string | null {
  if (entry.periodTotalSeconds == null || entry.periodWorkedSeconds == null || entry.amount == null || !entry.periodTotalSeconds) return null;
  const totalDays = entry.periodTotalSeconds / 86400, workedDays = entry.periodWorkedSeconds / 86400;
  const fullRate = entry.amount * entry.periodTotalSeconds / entry.periodWorkedSeconds;
  const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));
  const label = payModes[entry.mode || ''] || entry.mode || '';
  if (entry.periodWorkedSeconds >= entry.periodTotalSeconds) return `${label} · período completo de ${fmt(totalDays)} dias · ${money(fullRate)}`;
  return `${label} · ${money(fullRate)} a cada ${fmt(totalDays)} dias (${money(fullRate / totalDays)}/dia) · trabalhado ${fmt(workedDays)} de ${fmt(totalDays)} dias · ${money(entry.amount)}`;
}

export function WorkState({ loading, error, refresh }: { loading: boolean; error?: string; refresh: () => void }) {
  return loading ? <Feedback title="Conferindo seu trabalho" loading /> : error ? <Feedback title="Seus dados não foram carregados" message={error} onRetry={refresh} /> : null;
}
export function PeriodTabs({ value, onChange, occurrences = false, onOccurrences }: { value: WorkPeriod; onChange: (p: WorkPeriod) => void; occurrences?: boolean; onOccurrences?: () => void }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{([['today', 'Hoje'], ['week', 'Semana'], ['90', '90 dias']] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: !occurrences && id === value }} onPress={() => onChange(id)} style={{ paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: !occurrences && id === value ? colors.accentSoft : colors.card }}><Text style={[type.small, { color: colors.ink }]}>{label}</Text></Pressable>)}{onOccurrences && <Pressable accessibilityRole="tab" accessibilityState={{ selected: occurrences }} onPress={onOccurrences} style={{ padding: 10, minHeight: 40, borderRadius: 20, backgroundColor: occurrences ? colors.accentSoft : colors.card }}><Text style={[type.small, { color: colors.ink }]}>Ocorrências</Text></Pressable>}</View>;
}
export function WorkPair({ label, value }: { label: string; value: string }) {
  const { colors } = useZippyTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }}><Text style={[type.small, { flex: 1, color: colors.muted }]}>{label}</Text><Text style={[type.small, { flex: 1, color: colors.ink, fontWeight: '800', textAlign: 'right' }]}>{value}</Text></View>;
}
export function Balance({ amount, caption, detail }: { amount: number; caption: string; detail?: string }) {
  const { colors } = useZippyTheme();
  return <Surface hero style={{ padding: 23, borderRadius: 23 }}><Text style={[type.eyebrow, { color: colors.heroMuted, letterSpacing: 0 }]}>{caption}</Text><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 38, lineHeight: 48, color: colors.heroInk, marginTop: 12, flexShrink: 1 }}>{money(amount)}</Text>{detail && <Text style={[type.small, { color: colors.heroMuted, fontSize: 10, marginTop: 6 }]}>{detail}</Text>}</Surface>;
}
export const historyStatus: Record<string, string> = { completed: 'Concluída', failed: 'Não entregue', refused: 'Recusada', removed: 'Removida da fila', canceled: 'Cancelada', transferred: 'Transferida' };
export const settlementStatus: Record<string, string> = { draft: 'Aguardando sua conferência', reviewed: 'Conferido · pagamento pendente', disputed: 'Divergência registrada', paid: 'Loja registrou pagamento · confira o recebimento', received: 'Recebimento confirmado', cancelled: 'Acerto cancelado' };
