import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ShieldCheck } from 'lucide-react-native';
import { requestMotoboyLink } from '../services/mobileApi';
import { useEstablishmentLinks } from '../src/hooks/useEstablishmentLinks';
import { Button, Entrance, Feedback, Field, Header, Pill, Screen, Surface, type } from '../src/ui/Kit';
import { LinkStatus, StoreCard } from '../src/ui/EstablishmentKit';
import { useZippyTheme } from '../src/ui/theme';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function SolicitarRestauranteScreen() {
  const data = useEstablishmentLinks();
  const router = useRouter();
  const { colors } = useZippyTheme();
  const [query, setQuery] = useState('');
  const blocked = data.loading || data.busy || data.isLoading;
  const found = data.stores.filter(store => normalize([store.nome, store.cidade, store.uf].filter(Boolean).join(' ')).includes(normalize(query)));
  const request = (id: string) => {
    let createdId = '';
    void data.act(async () => { const created = await requestMotoboyLink(id); createdId = created.id; }, () => router.push({ pathname: '/solicitacoesVinculo', params: { id: createdId } }));
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Screen><Entrance>
    <Header title="Encontre sua próxima equipe." subtitle="Solicitar vínculo" onBack={() => { if (!blocked) router.replace('/selecionarRestaurante'); }} />
    <Field label="Buscar estabelecimento" placeholder="Nome ou cidade…" value={query} onChangeText={setQuery} autoCorrect={false} editable={!data.busy} />
    <Surface style={{ marginTop: 18, marginBottom: 18 }}><View style={{ flexDirection: 'row', gap: 10 }}><ShieldCheck size={20} color={colors.accent} /><Text style={[type.body, { color: colors.muted, flex: 1 }]}>A loja precisa aprovar o vínculo antes do seu primeiro turno.</Text></View></Surface>
    {data.loading && <Feedback title="Buscando estabelecimentos" loading />}
    {!!data.error && <Feedback title="Não foi possível continuar" message={data.error} onRetry={() => void data.reload()} />}
    {!data.loading && !data.error && <View style={{ gap: 12 }}>
      {found.map(store => {
        const linked = data.links.some(link => link.estabelecimentoId === store.id);
        const latest = data.requests.find(item => item.estabelecimentoId === store.id);
        const pending = latest?.status === 'pending';
        const invitation = pending && latest?.origem === 'estabelecimento';
        return <StoreCard key={store.id} name={store.nome} detail={[store.cidade, store.uf].filter(Boolean).join(' · ') || 'Localização não informada'}>
          {linked ? <Pill>Vínculo ativo</Pill> : latest ? <LinkStatus request={latest} /> : null}
          {linked ? <Button secondary disabled={blocked} onPress={() => router.replace('/selecionarRestaurante')}>Ver vínculo ativo</Button>
            : invitation && latest ? <Button secondary disabled={blocked} onPress={() => router.push({ pathname: '/convite/[id]', params: { id: latest.id } })}>Revisar convite</Button>
            : pending && latest ? <Button secondary disabled={blocked} onPress={() => router.push({ pathname: '/solicitacoesVinculo', params: { id: latest.id } })}>Acompanhar solicitação</Button>
            : <Button loading={data.busy} disabled={blocked} onPress={() => request(store.id)}>{latest?.status === 'rejected' ? 'Solicitar novamente' : 'Solicitar vínculo'}</Button>}
        </StoreCard>;
      })}
      {!found.length && <Feedback title={query.trim() ? 'Nenhuma loja encontrada' : 'Nenhum estabelecimento disponível'} message={query.trim() ? 'Tente outro nome ou cidade.' : 'Atualize a lista ou consulte o responsável pelo estabelecimento.'} />}
    </View>}
    <View style={{ marginTop: 20, gap: 12 }}><Button icon={Search} secondary disabled={blocked} onPress={() => void data.reload()}>Atualizar lista</Button><Button secondary disabled={blocked} onPress={() => router.push('/solicitacoesVinculo')}>Minhas solicitações</Button></View>
  </Entrance></Screen></KeyboardAvoidingView>;
}
