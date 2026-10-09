import React, { useCallback, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import { LocateFixed, MapPin, ShieldCheck } from 'lucide-react-native';
import { getSharing, setSharing } from '../services/routeApi';
import { useOperationalSession } from '../src/contexts/OperationalSessionContext';
import { useAuth } from '../src/contexts/AuthContext';
import { useTrackingDiagnostics } from '../src/hooks/useTrackingDiagnostics';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Pill, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function PrivacyScreen() {
  const turn = useOperationalSession(), auth = useAuth(), router = useRouter(), { colors } = useZippyTheme(), diagnostics = useTrackingDiagnostics();
  const [sharing, setValue] = useState<boolean | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), running = useRef(false);
  useFocusEffect(useCallback(() => { const c = new AbortController(); setValue(null); setError(''); if (turn.session) getSharing(c.signal).then(v => { if (!c.signal.aborted) setValue(v.compartilharLocalizacaoCliente); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Tente novamente.'); }); return () => c.abort(); }, [turn.session?.sessionId]));
  const change = async (value: boolean) => { if (running.current) return; running.current = true; setBusy(true); setError(''); const id = turn.session?.sessionId; try { const confirmed = await setSharing(value); if (turn.store.getSnapshot().session?.sessionId === id) setValue(confirmed.compartilharLocalizacaoCliente); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); } finally { running.current = false; setBusy(false); } };
  return <AccountScreen><Header title="Você sabe quem acompanha." subtitle="Localização & privacidade" onBack={() => router.back()} />
    <View style={{ height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>{[120, 84, 48].map(size => <View key={size} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: colors.line, position: 'absolute', backgroundColor: size === 48 ? colors.accentSoft : 'transparent' }} />)}<LocateFixed size={23} color={colors.accent} /></View>
    <Surface><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[type.small, { color: colors.ink, fontWeight: '800' }]}>Estabelecimento</Text><Pill icon={MapPin} tone={turn.session ? 'accent' : 'warning'}>{turn.session ? 'ATIVO' : 'OFFLINE'}</Pill></View><Text style={[type.small, { color: colors.muted, marginVertical: 13 }]}>A loja acompanha desde que você está online, inclusive durante a espera por pedidos e na pausa.</Text><Text style={[type.small, { color: colors.ink }]}>{auth.estabelecimentoAtual?.nome || 'Escolha sua loja'}</Text><Text style={[type.small, { color: colors.muted, marginTop: 10 }]}>Última amostra confirmada: {diagnostics.lastSent ? new Date(diagnostics.lastSent).toLocaleTimeString('pt-BR') : 'Sem envio confirmado neste turno'}</Text><Text style={[type.small, { color: colors.muted }]}>Amostras aguardando envio: {diagnostics.pending ?? 'Não disponível'}</Text></Surface>
    <Surface style={{ marginTop: 13, paddingVertical: 0 }}><MenuRow icon={ShieldCheck} title="Mostrar localização ao cliente" subtitle="Pelo canal autorizado da loja, durante a entrega." last right={<Switch accessibilityLabel="Mostrar localização ao cliente" disabled={sharing === null || busy || !turn.session} value={sharing === true} onValueChange={v => void change(v)} />} /></Surface>
    {!turn.session && <AccountNotice icon={ShieldCheck}>Essa preferência é consultada e alterada durante um turno ativo. A localização operacional da loja é necessária para trabalhar online.</AccountNotice>}
    {!!error && <Feedback title="A preferência foi mantida" message={error} />}
    <View style={{ marginTop: 17 }}><Button secondary icon={LocateFixed} onPress={() => router.push('/permissoes')}>Revisar permissões do aparelho</Button></View>
  </AccountScreen>;
}
