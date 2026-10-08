import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { Check, Clock, Route, ShieldCheck, X } from 'lucide-react-native';
import { acceptOffer, rejectOffer } from '../services/mobileApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAuth } from '../src/contexts/AuthContext';
import { useRouteAction } from '../src/hooks/useRouteAction';
import { AccountNotice } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Pill, SectionTitle, Surface, type } from '../src/ui/Kit';
import { MiniRouteMap, RouteScreen, StopRow } from '../src/ui/RouteKit';
import { useZippyTheme } from '../src/ui/theme';
import { OfferEarnings } from '../src/ui/OfferEarnings';

export default function OfferScreen() {
  const turn = useOperationalSession(), auth = useAuth(), router = useRouter(), action = useRouteAction(), { colors } = useZippyTheme();
  const offer = turn.queue?.offer, [now, setNow] = useState(Date.now()), [rejecting, setRejecting] = useState(false);
  const resolving = useRef(false);
  const navigation = useRootNavigationState();
  const deadline = offer ? Date.parse(offer.expiresAtUtc) : 0, remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (navigation?.key && turn.queue && turn.phase === 'online' && !resolving.current && !action.busy && !turn.busy && (!offer || remaining <= 0)) router.replace({ pathname: '/estadoRota', params: { tipo: 'offer-expired' } }); }, [navigation?.key, turn.queue, turn.phase, offer, remaining, turn.busy, action.busy, router]);
  const resolve = async (accept: boolean) => { if (!offer || remaining <= 0 || resolving.current) return; resolving.current = true; let success = false; await action.run(() => accept ? acceptOffer(offer.offerId ?? undefined, turn.queue?.version) : rejectOffer('Recusada pelo motoboy', offer.offerId ?? undefined), () => { success = true; router.replace(accept ? '/rota' : '/'); }); if (!success) resolving.current = false; };
  return <RouteScreen footer={<View style={{ gap: 10 }}><Button icon={Check} loading={action.busy} disabled={!offer || remaining <= 0 || action.busy} onPress={() => void resolve(true)}>Aceitar e conferir rota</Button><Button secondary icon={X} disabled={action.busy || !offer || turn.queue?.politicas?.allowMotoboyRefuse === false} onPress={() => setRejecting(v => !v)}>{rejecting ? 'Manter a oferta' : 'Recusar esta rota'}</Button>{rejecting && <Button danger icon={X} loading={action.busy} onPress={() => void resolve(false)}>Confirmar recusa</Button>}</View>}>
    <Header title="Tem caminho novo pra você." subtitle="Rota enviada pela loja" onBack={() => router.back()} />
    {offer && <><Surface hero style={{ padding: 22 }}><Pill icon={Route} inverse>{`NOVA ROTA · ${offer.stops.length} PARADAS`}</Pill><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 26, lineHeight: 30, color: colors.heroInk, marginTop: 16, letterSpacing: -1 }}>{[...new Set(offer.stops.map(s => s.pedido?.bairro).filter(Boolean))].join(' & ') || 'Um novo caminho'}</Text><Text style={[type.small, { color: colors.heroMuted, marginTop: 10 }]}>Retirada na {auth.estabelecimentoAtual?.nome}</Text></Surface><View style={{ height: 15 }} /><MiniRouteMap queue={{ ...turn.queue!, current: null, next: offer.stops }} caption="Confira destinos e sequência da oferta." /><View style={{ flexDirection: 'row', gap: 8, paddingVertical: 18 }}><Clock size={16} color={colors.warning} /><Text style={[type.small, { color: colors.warning }]}>Oferta válida por {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Text></View><SectionTitle>O que você vai levar</SectionTitle>{offer.stops.map((s, i) => <StopRow key={s.pedidoId} stop={s} index={i} />)}<AccountNotice icon={ShieldCheck}>Confira a cobrança de cada pedido na retirada. O aceite só é confirmado após resposta da loja.</AccountNotice></>}
    {offer && <OfferEarnings stops={offer.stops} />}
    {!!action.error && <Feedback title="A oferta não foi confirmada" message={action.error} onRetry={() => void turn.store.refreshQueue()} />}
  </RouteScreen>;
}
