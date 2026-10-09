import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock3, Search } from 'lucide-react-native';
import { useEstablishmentLinks } from '../src/hooks/useEstablishmentLinks';
import { Button, Entrance, Feedback, Header, Screen, Surface, type } from '../src/ui/Kit';
import { LinkStatus, StoreCard } from '../src/ui/EstablishmentKit';
import { useZippyTheme } from '../src/ui/theme';

export default function SolicitacoesVinculoScreen() {
  const data = useEstablishmentLinks();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { colors } = useZippyTheme();
  const selectedId = typeof id === 'string' ? id : undefined;
  const visible = selectedId ? data.requests.filter(request => request.id === selectedId) : data.requests;
  const blocked = data.loading || data.busy || data.isLoading;
  const request = selectedId ? visible[0] : undefined;
  const title = request?.status === 'rejected' ? 'Vamos tentar de novo?' : request?.status === 'approved' ? 'Tudo certo com o vínculo.' : request?.status === 'pending' ? 'Seu pedido está com a loja.' : 'Cada resposta no seu lugar.';
  return <Screen><Entrance>
    <Header title="Solicitação de vínculo" subtitle="Acompanhe as respostas." onBack={() => { if (!blocked) router.replace('/selecionarRestaurante'); }} />
    <View style={{ gap: 16, marginBottom: 24 }}><View style={{ width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft }}><Clock3 size={30} color={colors.warning} /></View><Text accessibilityRole="header" style={[type.title, { fontSize: 30, lineHeight: 38, color: colors.ink }]}>{title}</Text><Text style={[type.body, { color: colors.muted }]}>A solicitação só libera o trabalho depois da aprovação e da confirmação do vínculo ativo.</Text></View>
    {data.loading && <Feedback title="Consultando solicitações" loading />}
    {!!data.error && <Feedback title="Não foi possível consultar" message={data.error} onRetry={() => void data.reload()} />}
    {!data.loading && !data.error && <View style={{ gap: 14 }}>
      {visible.map(item => {
        const linked = data.links.some(link => link.estabelecimentoId === item.estabelecimentoId);
        return <StoreCard key={item.id} name={item.estabelecimentoNome} detail={item.origem === 'estabelecimento' ? 'Convite do estabelecimento' : 'Sua solicitação'}>
          <LinkStatus request={item} />
          <Text style={[type.body, { color: colors.muted }]}>{item.status === 'pending' ? item.origem === 'estabelecimento' ? 'Revise o convite e decida se deseja participar.' : 'Aguardando resposta do estabelecimento. Use Atualizar status para conferir.' : item.status === 'rejected' ? item.rejectionReason || 'A solicitação foi recusada. Você pode procurar outra loja ou tentar novamente.' : item.status === 'approved' ? linked ? 'Seu vínculo está ativo. Você já pode selecionar a loja.' : 'A aprovação foi registrada. Atualize os vínculos para conferir se a loja continua disponível.' : 'Este status ainda não está disponível no app. Atualize para conferir.'}</Text>
          {item.status === 'pending' && item.origem === 'estabelecimento' ? <Button disabled={blocked} onPress={() => router.push({ pathname: '/convite/[id]', params: { id: item.id } })}>Revisar convite</Button> : linked ? <Button disabled={blocked} onPress={() => router.replace('/selecionarRestaurante')}>Selecionar estabelecimento</Button> : item.status === 'rejected' ? <Button secondary disabled={blocked} onPress={() => router.push('/solicitarRestaurante')}>Procurar outra loja</Button> : null}
        </StoreCard>;
      })}
      {!visible.length && <Surface><Text style={[type.body, { color: colors.ink, fontWeight: '800' }]}>{selectedId ? 'Solicitação não encontrada' : 'Você ainda não tem solicitações'}</Text><Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>{selectedId ? 'Atualize a lista para conferir o andamento.' : 'Encontre uma loja e solicite seu primeiro vínculo.'}</Text></Surface>}
    </View>}
    <View style={{ marginTop: 24, gap: 12 }}><Button secondary disabled={blocked} onPress={() => void data.reload()}>Atualizar status</Button><Button icon={Search} secondary disabled={blocked} onPress={() => router.push('/solicitarRestaurante')}>Procurar outra loja</Button></View>
  </Entrance></Screen>;
}
