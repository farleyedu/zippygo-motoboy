import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, ShieldCheck } from 'lucide-react-native';
import { historyWindow, type WorkPeriod } from '../services/workApi';
import { useWork } from '../src/hooks/useWork';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header, Surface, money, type } from '../src/ui/Kit';
import { PeriodTabs, WorkState, historyStatus } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';

export default function HistoryScreen() {
  const router = useRouter(), [period, setPeriod] = useState<WorkPeriod>('today'), [occurrences, setOccurrences] = useState(false), work = useWork(period), { colors } = useZippyTheme();
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [rangeError, setRangeError] = useState('');
  const search = () => {
    try { setPeriod(historyWindow(from, to)); setRangeError(''); }
    catch (e) { setRangeError(e instanceof Error ? e.message : 'Confira as datas.'); }
  };
  const data = work.data, rows = data?.history.filter(h => !occurrences || h.status !== 'completed') ?? [];
  return <AccountScreen active="earnings"><Header title="Seu caminho fica registrado." subtitle="Histórico de entregas" onBack={() => router.back()} /><PeriodTabs value={period} onChange={p => { setPeriod(p); setOccurrences(false); }} occurrences={occurrences} onOccurrences={() => setOccurrences(v => !v)} /><View style={{ gap: 10, marginBottom: 18 }}><Field label="De · AAAA-MM-DD" value={from} onChangeText={setFrom} maxLength={10} /><Field label="Até · AAAA-MM-DD" value={to} onChangeText={setTo} maxLength={10} /><Button secondary onPress={search}>Consultar outro período</Button>{!!rangeError && <Feedback title="Confira o período" message={rangeError} />}</View><WorkState {...work} />{data && <><View style={{ flexDirection: 'row', gap: 12, marginVertical: 12 }}>{[[String(data.history.filter(h => h.status === 'completed').length), 'concluídas'], [String(data.history.filter(h => h.status !== 'completed').length), 'ocorrências']].map(([value, label]) => <View key={label} style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 25, color: colors.ink }}>{value}</Text><Text style={[type.small, { color: colors.muted }]}>{label}</Text></View>)}</View><Surface style={{ paddingVertical: 0 }}>{!rows.length && <Text style={[type.small, { color: colors.muted, paddingVertical: 20 }]}>Nenhum registro neste período.</Text>}{rows.map((h, i) => <MenuRow key={h.stopId} icon={Package} title={`#${h.pedidoId}${h.district ? ` · ${h.district}` : ''}`} subtitle={`${historyStatus[h.status] || h.status} · ${new Date(h.updatedAtUtc).toLocaleString('pt-BR')}${h.backfilled ? ' · valor aplicado depois pela loja' : ''}`} right={<Text style={[type.small, { maxWidth: 95, color: colors.accent, textAlign: 'right' }]}>{h.status !== 'completed' ? 'Sem ganho por entrega' : h.mode && !['delivery', 'distance'].includes(h.mode) ? 'Por período' : h.amount == null ? 'Não registrado' : money(h.amount)}</Text>} onPress={() => router.push({ pathname: '/reciboHistorico', params: { stop: h.stopId, period: typeof period === 'string' ? period : 'custom', ...(typeof period === 'object' ? period : {}) } })} last={i === rows.length - 1} />)}</Surface><AccountNotice icon={ShieldCheck}>Endereços completos e contatos dos clientes não aparecem no histórico.</AccountNotice></>}</AccountScreen>;
}
