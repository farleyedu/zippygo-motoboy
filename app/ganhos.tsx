import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { History, ShieldCheck, Wallet } from 'lucide-react-native';
import { payModes, type WorkPeriod } from '../services/workApi';
import { useWork } from '../src/hooks/useWork';
import { AccountNotice, AccountScreen } from '../src/ui/AccountKit';
import { Button, Header, IconButton, SectionTitle, Surface, money, type } from '../src/ui/Kit';
import { Balance, periodBreakdown, PeriodTabs, WorkPair, WorkState } from '../src/ui/WorkKit';
import { useZippyTheme } from '../src/ui/theme';

export default function EarningsScreen() {
  const router = useRouter(), [period, setPeriod] = useState<WorkPeriod>('today'), work = useWork(period), { colors } = useZippyTheme();
  const data = work.data;
  const chart = Array.from({ length: 7 }, (_, i) => { const day = new Date(Date.now() - (6 - i) * 86400000); const label = day.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).slice(0, 1).toUpperCase(); const key = day.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); const total = data?.entries.filter(e => new Date(e.toUtc).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === key).reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0; return { label, total }; });
  const max = Math.max(1, ...chart.map(d => d.total));
  return <AccountScreen active="earnings" footer={data ? <Button icon={Wallet} onPress={() => router.push('/acerto')}>Conferir acerto com a loja</Button> : undefined}>
    <Header title="Seu trabalho vale." subtitle="Meus ganhos" onBack={() => router.back()} right={<IconButton icon={History} label="Histórico de entregas" onPress={() => router.push('/historico')} />} />
    <PeriodTabs value={period} onChange={setPeriod} /><WorkState {...work} />
    {data && <><Balance amount={data.earnings} caption="SEUS GANHOS CONFERIDOS NO PERÍODO" detail={`${data.history.filter(h => h.status === 'completed').length} entregas concluídas · sem incluir dinheiro da loja`} />
      <SectionTitle>Regra definida pela loja</SectionTitle><Surface>{data.plan ? <><WorkPair label="Remuneração" value={`${money(data.plan.rate)} ${payModes[data.plan.mode]}`} /><Text style={[type.small, { color: colors.muted, marginTop: 10 }]}>{['delivery', 'distance'].includes(data.plan.mode) ? 'Cada entrega mantém a regra e o valor informados na atribuição.' : 'O valor do período é fixo. Horas ou períodos encerrados aparecem como ganho após conferência da loja, sem acréscimo por entrega.'}</Text></> : <Text style={[type.body, { color: colors.muted }]}>A loja ainda não configurou sua remuneração.</Text>}</Surface>
      {period !== 'today' && <><SectionTitle>Um caminho consistente</SectionTitle><View style={{ flexDirection: 'row', height: 112, gap: 12, alignItems: 'flex-end', paddingHorizontal: 10 }}>{chart.map((d, i) => <View key={i} accessibilityLabel={`${d.label}: ${money(d.total)}`} style={{ flex: 1, alignItems: 'center', gap: 8 }}><View style={{ width: '100%', height: d.total ? Math.max(3, d.total / max * 78) : 1, borderRadius: 5, backgroundColor: i === 6 ? colors.accent : colors.accentSoft }} /><Text style={[type.small, { color: colors.muted }]}>{d.label}</Text></View>)}</View></>}
      <SectionTitle>São contas diferentes.</SectionTitle><Surface style={{ backgroundColor: colors.warningSoft }}><WorkPair label="Dinheiro da loja a devolver" value={money(data.balance.cashToReturn)} /><Text style={[type.small, { color: colors.muted, marginTop: 8 }]}>Esse dinheiro pertence ao estabelecimento. Não é descontado automaticamente do seu ganho.</Text></Surface>
      <SectionTitle>Seu saldo</SectionTitle><WorkPair label="A receber · todos os períodos" value={money(data.balance.outstanding)} />
      {!!data.unpricedDeliveries && <AccountNotice icon={ShieldCheck} warning>{`${data.unpricedDeliveries} entrega(s) sem remuneração registrada. Esses valores não foram tratados como ganho zero.`}</AccountNotice>}
      {!!data.unconfirmedReceipts && <AccountNotice icon={ShieldCheck} warning>Há recebimentos de entregas ainda não conferidos. O saldo da loja mostra apenas valores registrados, não uma quitação dessas pendências.</AccountNotice>}
      <SectionTitle>Últimos lançamentos</SectionTitle>{!data.entries.length && <Text style={[type.small, { color: colors.muted }]}>Nenhum ganho conferido neste período.</Text>}{data.entries.slice(0, 5).map(e => <View key={e.id}>
        <WorkPair label={e.kind === 'delivery' ? `Pedido #${e.pedidoId}` : `${payModes[e.mode || '']} · ${e.workedMinutes != null ? `${e.workedMinutes} min` : new Date(e.toUtc).toLocaleDateString('pt-BR')}`} value={e.amount == null ? 'Não registrado' : e.kind === 'delivery' && e.mode && !['delivery', 'distance'].includes(e.mode) ? 'Incluído no período' : money(e.amount)} />
        {!!periodBreakdown(e) && <Text style={[type.small, { color: colors.muted, marginTop: -6, marginBottom: 6 }]}>{periodBreakdown(e)}</Text>}
        {!!e.backfilled && <Text style={[type.small, { color: colors.warning, marginTop: -6, marginBottom: 6 }]}>Valor aplicado pela loja depois da entrega, com a regra atual · dinheiro do cliente não incluído aqui</Text>}
      </View>)}
    </>}
  </AccountScreen>;
}
