import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { History, Package, Route, ShieldCheck } from 'lucide-react-native';
import type { WorkPeriod } from '../services/workApi';
import { useRouteHistory } from '../src/hooks/useRouteHistory';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Header, SectionTitle, Surface, money, type } from '../src/ui/Kit';
import { PeriodTabs, WorkState } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';
const status = { active: 'Em andamento', returning: 'Voltando à loja', completed: 'Concluída', interrupted: 'Interrompida' };
export default function RouteHistoryScreen() {
  const router = useRouter(), { colors } = useZippyTheme(), [period, setPeriod] = useState<WorkPeriod>('today'), [offset, setOffset] = useState(0), history = useRouteHistory(period, offset);
  const rows = history.data?.routes || [];
  return <AccountScreen active="earnings"><Header title="Seu caminho fica registrado." subtitle="Histórico de rotas" onBack={() => router.back()} /><PeriodTabs value={period} onChange={p => { setPeriod(p); setOffset(0); }} /><WorkState {...history} />{history.data && <>
    <View style={{ flexDirection: 'row', gap: 16, marginVertical: 18 }}>{[[String(rows.length), 'rotas nesta página'], [String(rows.reduce((n, r) => n + r.completedCount, 0)), 'entregas concluídas']].map(([value, label]) => <View key={label} style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 27, color: colors.ink }}>{value}</Text><Text style={[type.small, { color: colors.muted }]}>{label}</Text></View>)}</View>
    <SectionTitle>Cada viagem, seus detalhes</SectionTitle><Surface style={{ paddingVertical: 0 }}>{!rows.length && <View style={{ alignItems: 'center', paddingVertical: 30, gap: 12 }}><History color={colors.accent} size={30} /><Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>Nenhuma rota registrada neste período.</Text></View>}{rows.map((r, i) => <MenuRow key={r.id} icon={Route} title={new Date(r.startedAtUtc).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + r.orderCount + ' pedidos'} subtitle={status[r.status] + ' · ' + r.completedCount + ' entregues'} right={<Text style={[type.small, { color: colors.accent, fontWeight: '800' }]}>{money(r.earnings)}</Text>} onPress={() => router.push({ pathname: '/rotaHistorico', params: { id: r.id } })} last={i === rows.length - 1} />)}</Surface>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>{offset > 0 && <View style={{ flex: 1 }}><Button secondary onPress={() => setOffset(v => Math.max(0, v - 30))}>Anteriores</Button></View>}{history.data.hasMore && <View style={{ flex: 1 }}><Button secondary onPress={() => setOffset(history.data!.nextOffset)}>Próximas</Button></View>}</View>
  </>}<AccountNotice icon={ShieldCheck}>Cada rota guarda o GPS real a partir da retirada. Trechos sem sinal aparecem separados; destinos e contatos permanecem protegidos.</AccountNotice><Surface style={{ paddingVertical: 0 }}><MenuRow icon={Package} title="Histórico de entregas" subtitle="Pedidos anteriores e ocorrências" onPress={() => router.push('/historico')} last /></Surface></AccountScreen>;
}
