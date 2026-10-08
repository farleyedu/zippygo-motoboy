import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { type WorkPeriod } from '../services/workApi';
import { useWork } from '../src/hooks/useWork';
import { AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Header, SectionTitle, Surface, money, type } from '../src/ui/Kit';
import { WorkPair, WorkState, historyStatus } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';

export default function HistoryReceiptScreen() {
  const params = useLocalSearchParams<{ stop: string; period: string; from?: string; to?: string }>(), router = useRouter(), { colors } = useZippyTheme();
  const period = useMemo<WorkPeriod>(() => params.period === 'custom' && params.from && params.to ? { from: params.from, to: params.to } : params.period === 'today' || params.period === 'week' ? params.period : '90', [params.period, params.from, params.to]);
  const work = useWork(period), h = work.data?.history.find(row => row.stopId === Number(params.stop));
  let receipt: Exclude<typeof h, undefined>['receipt'];
  try { receipt = typeof h?.receipt === 'string' ? JSON.parse(h.receipt) : h?.receipt; } catch { receipt = undefined; }
  const r = typeof receipt === 'object' ? receipt : undefined;
  return <AccountScreen active="earnings"><Header title="Cada detalhe registrado." subtitle={h ? `Recibo · #${h.pedidoId}` : 'Recibo da entrega'} onBack={() => router.back()} /><WorkState {...work} />{work.data && !h && <Feedback title="Registro não encontrado neste período" message="Volte ao histórico e atualize a lista." />}{h && <><Surface><WorkPair label={`Pedido #${h.pedidoId}`} value={historyStatus[h.status] || h.status} /><WorkPair label="Destino" value={h.district || 'Endereço protegido'} /><WorkPair label="Entrega" value={new Date(h.updatedAtUtc).toLocaleString('pt-BR')} /><WorkPair label="Código" value={r ? r.CodeChecked ? 'Conferido no servidor' : 'Não exigido' : 'Conferência indisponível'} /><WorkPair label="Seu ganho" value={h.status !== 'completed' ? 'Sem ganho por entrega' : h.mode && !['delivery', 'distance'].includes(h.mode) ? 'Remunerado por período' : money(h.amount)} />{h.backfilled && <WorkPair label="Origem do valor" value="Aplicado pela loja depois da entrega" />}{h.distanceKm != null &&<WorkPair label="Distância · linha reta" value={`${h.distanceKm.toLocaleString('pt-BR')} km`} />}{r?.PaidBeforeDelivery && <WorkPair label="Recebimento" value="Pago antes da entrega" />}{r?.Payments.map((p, i) => <WorkPair key={i} label={`Recebimento · ${p.Method}`} value={`${money(p.Amount)}${p.CashReceived != null ? ` · troco ${money(p.CashReceived - p.Amount)}` : ''}`} />)}<Text style={[type.small, { color: colors.muted, marginTop: 12 }]}>{h.operationId || `ZG · ${h.pedidoId} · registro operacional`}</Text></Surface><SectionTitle>O caminho dessa entrega</SectionTitle>{[[h.assignedAtUtc, 'Atribuição registrada'], [h.pickedUpAtUtc, 'Coleta registrada'], [h.arrivedAtUtc, 'Chegada registrada'], [h.updatedAtUtc, historyStatus[h.status] || h.status]].filter(([date]) => date).map(([date, label], i) => <View key={i} style={{ paddingLeft: 17, paddingVertical: 14, borderLeftWidth: 2, borderColor: colors.line }}><Text style={[type.small, { color: colors.ink, fontWeight: '800' }]}>{label}</Text><Text style={[type.small, { color: colors.muted }]}>{new Date(date!).toLocaleString('pt-BR')}</Text></View>)}<View style={{ marginTop: 20 }}><Button secondary icon={HelpCircle} onPress={() => router.push({ pathname: '/suporte', params: { category: 'delivery', pedido: h.pedidoId } })}>Preciso revisar esta entrega</Button></View></>}</AccountScreen>;
}
