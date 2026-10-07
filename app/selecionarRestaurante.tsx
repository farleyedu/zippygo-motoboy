import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock3, Search, Users } from 'lucide-react-native';
import { useEstablishmentLinks } from '../src/hooks/useEstablishmentLinks';
import { AuthLink } from '../src/ui/AuthKit';
import { Button, Entrance, Feedback, Header, Pill, Screen, SectionTitle, Surface, type } from '../src/ui/Kit';
import { LinkStatus, StoreCard } from '../src/ui/EstablishmentKit';
import { useZippyTheme } from '../src/ui/theme';

export default function SelecionarRestauranteScreen() {
  const data = useEstablishmentLinks();
  const router = useRouter();
  const { colors } = useZippyTheme();
  const [pending, setPending] = useState<string | null>(null);
  const current = data.estabelecimentoAtual;
  const currentId = current && 'estabelecimentoId' in current ? current.estabelecimentoId : current?.id;
  const selectedId = pending ?? currentId ?? data.links[0]?.estabelecimentoId;
  const selected = data.links.find(link => link.estabelecimentoId === selectedId);
  const invitations = data.requests.filter(request => request.status === 'pending' && request.origem === 'estabelecimento');
  const blocked = data.loading || data.busy || data.isLoading;
  const enter = () => void data.act(async () => {
    if (!selected) throw new Error('Selecione um vínculo ativo para continuar.');
    const result = await data.selectEstablishment(selected);
    if (!result.success) throw new Error(result.error || 'Não foi possível selecionar.');
  }, () => router.replace('/'));

  return <Screen footer={data.user && !data.loading ? <View style={{ gap: 10 }}>
    <Button loading={data.busy} disabled={blocked || (!!data.links.length && !selected)} onPress={data.links.length ? enter : () => router.push('/solicitarRestaurante')}>{data.links.length ? 'Trabalhar nesta loja' : 'Solicitar meu primeiro vínculo'}</Button>
    <Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>{selected ? selected.nome + ' selecionada.' : 'A aprovação do vínculo vem antes do turno.'}</Text>
  </View> : undefined}>
    <Entrance>
      <Header title="Onde vamos hoje?" subtitle="Escolha seu estabelecimento." onBack={() => { if (!blocked) router.replace(current ? '/' : '/(auth)/login'); }} />
      <Surface hero><Text style={[type.eyebrow, { color: colors.heroMuted }]}>SUA EQUIPE, SUA BASE.</Text><Text accessibilityRole="header" style={[type.title, { color: colors.heroInk, fontSize: 28, lineHeight: 35, marginTop: 15 }]}>O turno começa aqui.</Text><Text style={[type.body, { color: colors.heroMuted, marginTop: 12 }]}>Um lugar de cada vez. Um caminho bem definido.</Text></Surface>
      {data.loading && <View style={{ marginTop: 18 }}><Feedback title="Carregando seus vínculos" loading /></View>}
      {data.error && <View style={{ marginTop: 18 }}><Feedback title="Não foi possível continuar" message={data.error} onRetry={() => void data.reload()} /></View>}
      {!data.loading && <>
        <SectionTitle right={<AuthLink disabled={blocked} onPress={() => router.push('/solicitarRestaurante')}>Buscar loja</AuthLink>}>Meus vínculos</SectionTitle>
        <View style={{ gap: 12 }}>{data.links.map(link => <StoreCard key={link.estabelecimentoId} name={link.nome} detail="Vínculo de motoboy ativo" selected={selectedId === link.estabelecimentoId} disabled={blocked} onPress={() => setPending(link.estabelecimentoId)}><Pill>APROVADO</Pill></StoreCard>)}</View>
        {!data.links.length && !data.error && <Surface><Text style={[type.eyebrow, { color: colors.accent }]}>SEU PRIMEIRO VÍNCULO</Text><Text style={[type.title, { color: colors.ink, marginTop: 12 }]}>Encontre sua equipe.</Text><Text style={[type.body, { color: colors.muted, marginTop: 10 }]}>Solicite um vínculo ou aceite um convite. A aprovação libera seu primeiro turno.</Text></Surface>}
        <SectionTitle>Convites & solicitações</SectionTitle>
        <View style={{ gap: 12 }}>{invitations.map(invite => <StoreCard key={invite.id} name={invite.estabelecimentoNome} detail="A loja quer você na equipe."><LinkStatus request={invite} /><Button icon={Users} secondary disabled={blocked} onPress={() => router.push({ pathname: '/convite/[id]', params: { id: invite.id } })}>Revisar convite</Button></StoreCard>)}</View>
        <Surface style={{ marginTop: 12 }}><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>Minhas solicitações</Text><Text style={[type.small, { color: colors.muted, marginTop: 5 }]}>Acompanhe aprovação e respostas da loja.</Text><View style={{ marginTop: 12 }}><Button icon={Clock3} secondary disabled={blocked} onPress={() => router.push('/solicitacoesVinculo')}>Acompanhar solicitações</Button></View></Surface>
        <View style={{ marginTop: 18 }}><Button icon={Search} secondary disabled={blocked} onPress={() => void data.reload()}>Atualizar vínculos</Button></View>
      </>}
    </Entrance>
  </Screen>;
}
