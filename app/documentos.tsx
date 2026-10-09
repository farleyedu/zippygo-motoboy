import React, { useCallback, useRef, useState } from 'react';
import { Image, Modal, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import { Bike, Camera, Check, FileText, ImageIcon, ShieldCheck, X } from 'lucide-react-native';
import { getOwnDocumentImage, getOwnDocuments, OwnDocument, sendOwnImage } from '../services/accountApi';
import { chooseAccountImage } from '../services/accountImage';
import { useAccountSave } from '../src/hooks/useAccountSave';
import { AccountNotice, AccountScreen, MenuRow } from '../src/ui/AccountKit';
import { Button, Feedback, Header, Pill, Surface, type } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function DocumentsScreen() {
  const router = useRouter(), { colors } = useZippyTheme(), save = useAccountSave();
  const [documents, setDocuments] = useState<OwnDocument[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState<OwnDocument['tipo'] | null>(null), [image, setImage] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => { request.current?.abort(); const c = new AbortController(); request.current = c; setLoading(true); setError(''); try { const list = await getOwnDocuments(c.signal); if (!c.signal.aborted) setDocuments(list); } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Tente novamente.'); } finally { if (!c.signal.aborted) setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void reload(); return () => { request.current?.abort(); setImage(null); }; }, [reload]));
  const send = (camera: boolean) => void save.run(async () => { if (!selected) return false; const base64 = await chooseAccountImage(camera); if (!base64) return false; await sendOwnImage(selected, base64); setSelected(null); await reload(); }, 'Documento recebido no seu cadastro. O envio não equivale à aprovação.');
  const types = [{ id: 'identificacao' as const, title: 'Identificação', icon: ShieldCheck }, { id: 'cnh' as const, title: 'CNH', icon: FileText }, { id: 'moto' as const, title: 'Documento da moto', icon: Bike }];
  return <AccountScreen>
    <Header title="Tudo em dia." subtitle="Meus documentos" onBack={() => router.back()} />
    <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 29, lineHeight: 32, letterSpacing: -1.2, color: colors.ink, marginTop: 15, marginBottom: 12 }}>{'Sua documentação.\nSem confusão.'}</Text>
    <Text style={{ fontFamily: 'Manrope', fontSize: 13, lineHeight: 21, color: colors.muted, marginBottom: 15 }}>Documentos solicitados pela operação. Cada envio mostra o que falta e o andamento.</Text>
    {loading && <Feedback title="Conferindo seus documentos" loading />}{!!error && <Feedback title="Seus documentos não carregaram" message={error} onRetry={() => void reload()} />}
    {types.map(t => { const doc = documents.find(d => d.tipo === t.id); return <Surface key={t.id} style={{ padding: 16, marginBottom: 12, borderRadius: 17 }}><MenuRow icon={t.icon} title={t.title} subtitle={doc ? `Recebido em ${new Date(doc.enviadoEmUtc).toLocaleDateString('pt-BR')} · toque para ver` : 'Nenhum envio confirmado'} last onPress={() => doc ? void save.run(async () => { setImage(await getOwnDocumentImage(doc.id)); }, '') : setSelected(t.id)} right={<Pill icon={doc ? Check : FileText} tone={doc ? 'accent' : 'warning'}>{doc ? 'ENVIADO' : 'SEM ENVIO'}</Pill>} /></Surface>; })}
    {!!save.failure && <Feedback title="Confira seu documento" message={save.failure} />}{!!save.success && <AccountNotice icon={Check}>{save.success}</AccountNotice>}
    <Button secondary icon={Camera} disabled={loading || !!error || save.saving} onPress={() => setSelected('identificacao')}>Enviar documento</Button>
    <AccountNotice icon={ShieldCheck}>Documentos ficam no seu cadastro, fora das conversas com clientes. Fotos JPG ou PNG de até 4 MB.</AccountNotice>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => { if (!save.saving) setSelected(null); }}><View style={{ flex: 1, backgroundColor: '#081426bb', justifyContent: 'center', padding: 22 }}><Surface><Text style={[type.title, { color: colors.ink, marginBottom: 16 }]}>Enviar documento</Text>{types.map(t => <MenuRow key={t.id} icon={t.icon} title={t.title} onPress={() => setSelected(t.id)} disabled={save.saving} right={selected === t.id ? <Check size={18} color={colors.accent} /> : <View />} last />)}<View style={{ gap: 12, marginTop: 16 }}><Button icon={Camera} loading={save.saving} onPress={() => send(true)}>Tirar foto</Button><Button secondary icon={ImageIcon} disabled={save.saving} onPress={() => send(false)}>Escolher da galeria</Button><Button secondary icon={X} disabled={save.saving} onPress={() => setSelected(null)}>Cancelar</Button>{!!save.failure && <Text style={[type.small, { color: colors.danger }]}>{save.failure}</Text>}</View></Surface></View></Modal>
    <Modal visible={!!image} transparent animationType="fade" onRequestClose={() => setImage(null)}><View style={{ flex: 1, backgroundColor: '#081426ee', justifyContent: 'center', padding: 22 }}>{image && <Image source={{ uri: image }} resizeMode="contain" style={{ height: '75%', width: '100%' }} />}<Button secondary onPress={() => setImage(null)}>Fechar documento</Button></View></Modal>
  </AccountScreen>;
}
