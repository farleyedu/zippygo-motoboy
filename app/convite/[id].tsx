import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Users, X } from 'lucide-react-native';
import { acceptMotoboyInvite, rejectMotoboyInvite } from '../../services/mobileApi';
import { useEstablishmentLinks } from '../../src/hooks/useEstablishmentLinks';
import { Button, Entrance, Feedback, Header, Screen, Surface, type } from '../../src/ui/Kit';
import { LinkStatus, StoreCard } from '../../src/ui/EstablishmentKit';
import { useZippyTheme } from '../../src/ui/theme';

export default function ConviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useEstablishmentLinks(typeof id === 'string' ? id : '');
  const router = useRouter();
  const { colors } = useZippyTheme();
  const [result, setResult] = useState<'accepted' | 'rejected' | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  useEffect(() => { setResult(null); setConfirmReject(false); }, [id]);
  const invite = data.requests.find(request => request.id === id && request.origem === 'estabelecimento');
  const blocked = data.loading || data.busy || data.isLoading;
  const respond = (accept: boolean) => {
    if (!invite || invite.status !== 'pending') return;
    void data.act(async () => { if (accept) await acceptMotoboyInvite(invite.id); else await rejectMotoboyInvite(invite.id); }, () => { setResult(accept ? 'accepted' : 'rejected'); setConfirmReject(false); });
  };
  return <Screen><Entrance>
    <Header title="Tem um convite pra você." onBack={() => { if (!blocked) router.replace('/selecionarRestaurante'); }} />
    <View style={{ gap: 18, marginBottom: 26 }}><View style={{ width: 76, height: 76, borderRadius: 25, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Users size={32} color={colors.accent} /></View><Text accessibilityRole="header" style={[type.title, { fontSize: 32, lineHeight: 40, color: colors.ink }]}>Uma nova equipe.{'\n'}Mais um <Text style={{ color: colors.accent }}>caminho.</Text></Text></View>
    {data.loading && <Feedback title="Consultando convite" loading />}
    {!!data.error && <Feedback title="Não foi possível continuar" message={data.error} onRetry={() => void data.reload()} />}
    {!data.loading && !data.error && (result ? <>
      <Feedback title={result === 'accepted' ? 'Convite aceito' : 'Convite recusado'} message={result === 'accepted' ? 'A loja confirmou seu vínculo. Confira seus estabelecimentos antes de iniciar o turno.' : 'Sua resposta foi registrada. Você pode procurar outra equipe.'} />
      <Button onPress={() => router.replace('/selecionarRestaurante')}>Ver meus vínculos</Button>
    </> : invite ? <>
      <Surface hero><Text style={[type.eyebrow, { color: colors.heroMuted }]}>CONVITE DO ESTABELECIMENTO</Text><Text style={[type.title, { color: colors.heroInk, fontSize: 27, lineHeight: 34, marginTop: 15 }]}>{invite.estabelecimentoNome}</Text><Text style={[type.body, { color: colors.heroMuted, marginTop: 12 }]}>Sua próxima equipe começa com a sua escolha.</Text></Surface>
      <View style={{ marginTop: 18 }}><LinkStatus request={invite} /></View>
      {invite.status === 'pending' ? <>
        <Text style={[type.body, { color: colors.muted, marginVertical: 22 }]}>A loja quer vincular você à equipe de entregas. Você decide se deseja participar.</Text>
        {confirmReject ? <StoreCard name={invite.estabelecimentoNome} detail="Deseja recusar este convite?"><Button icon={X} secondary loading={data.busy} disabled={blocked} onPress={() => respond(false)}>Confirmar recusa</Button><Button secondary disabled={blocked} onPress={() => setConfirmReject(false)}>Manter convite</Button></StoreCard> : <View style={{ gap: 12 }}><Button icon={Check} loading={data.busy} disabled={blocked} onPress={() => respond(true)}>Aceitar convite</Button><Button icon={X} secondary disabled={blocked} onPress={() => setConfirmReject(true)}>Recusar convite</Button></View>}
      </> : <View style={{ marginTop: 20 }}><Feedback title="Este convite já foi respondido" message="Atualize seus vínculos para consultar a situação atual." /><Button secondary onPress={() => router.replace('/selecionarRestaurante')}>Ver meus vínculos</Button></View>}
    </> : <Feedback title="Convite não encontrado" message="O convite pode ter sido respondido ou estar indisponível. Volte aos seus vínculos e atualize a lista." />)}
  </Entrance></Screen>;
}
