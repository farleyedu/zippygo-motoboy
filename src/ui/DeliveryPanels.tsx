import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Check, ImagePlus, ShieldCheck, Shuffle } from 'lucide-react-native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { parseCents, paymentError } from '../delivery/completionRules';
import type { PaymentMethod, PaymentPart } from '../../services/completionApi';
import { readPendingDeliveryProof } from '../../services/completionApi';
import { chooseAccountImage } from '../../services/accountImage';
import { Button, Field, type } from './Kit';
import { methodNames, money } from './CompletionKit';
import { PaymentMethodSelect } from './PaymentMethodSelect';
import { useZippyTheme } from './theme';

export function DeliveryCodePanel() {
  const completion = useDeliveryCompletion(), { colors, dark } = useZippyTheme(), d = completion.draft;
  const [digits, setDigits] = useState(['', '', '', '']), refs = useRef<(TextInput | null)[]>([]);
  return <View style={{ marginTop: 13 }}>
    <View style={{ flexDirection: 'row', gap: 5 }}>{digits.map((value, i) => <TextInput key={i} ref={input => { refs.current[i] = input; }} accessibilityLabel={`Dígito ${i + 1} do código`} inputMode="numeric" keyboardType="number-pad" maxLength={4}
      value={d?.codeChecked ? d.request.codigo?.[i] || '' : value} editable={d?.phase === 'draft' && !d.codeChecked && !completion.busy}
      onKeyPress={e => { if (e.nativeEvent.key === 'Backspace' && !value && i > 0) refs.current[i - 1]?.focus(); }}
      onChangeText={text => { const clean = text.replace(/\D/g, ''); setDigits(old => { const next = [...old]; if (clean.length > 1) clean.slice(0, 4 - i).split('').forEach((digit, k) => { next[i + k] = digit; }); else next[i] = clean; return next; }); if (clean) refs.current[Math.min(3, i + clean.length)]?.focus(); }}
      style={{ flex: 1, minWidth: 0, maxWidth: 54, height: 54, textAlign: 'center', fontFamily: 'ManropeExtraBold', fontSize: 23, borderRadius: 12, borderWidth: 1, borderColor: d?.codeChecked ? colors.success : colors.line, backgroundColor: d?.codeChecked ? dark ? '#214135' : '#d7efdf' : colors.card, color: d?.codeChecked ? dark ? '#b4efcb' : '#205f3d' : colors.ink }} />)}</View>
    {!d?.codeChecked && <View style={{ marginTop: 12 }}><Button icon={ShieldCheck} disabled={digits.join('').length !== 4 || d?.phase !== 'draft' || completion.busy} loading={completion.busy} onPress={() => void completion.validateCode(digits.join(''))}>Validar código</Button></View>}
  </View>;
}

export function DeliveryPaymentPanel({ initiallySplit = false, onEditingChange }: { initiallySplit?: boolean; onEditingChange: (editing: boolean) => void }) {
  const completion = useDeliveryCompletion(), d = completion.draft, c = d?.context, { colors } = useZippyTheme();
  const existing = d?.request.payments || [], [split, setSplit] = useState(initiallySplit || existing.length === 2);
  const [methods, setMethods] = useState<PaymentMethod[]>([existing[0]?.method || 'dinheiro', existing[1]?.method || 'pix']);
  const [amounts, setAmounts] = useState([existing[0] ? moneyText(existing[0].amount) : '', existing[1] ? moneyText(existing[1].amount) : '']);
  const [cash, setCash] = useState([existing[0]?.cashReceived == null ? '' : moneyText(existing[0].cashReceived), existing[1]?.cashReceived == null ? '' : moneyText(existing[1].cashReceived)]);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const cleared = useRef(false), pendingClear = useRef(Promise.resolve()), active = useRef(true), saveLock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const edit = () => {
    setDirty(true); onEditingChange(true); setError('');
    if (!cleared.current) {
      cleared.current = true;
      pendingClear.current = completion.preparePayment([]);
      void pendingClear.current.catch(failure => { if (active.current) setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o recebimento.'); });
    }
  };
  const parts: PaymentPart[] = (split ? [0, 1] : [0]).map(i => ({ method: methods[i], amount: split ? (parseCents(amounts[i]) ?? 0) / 100 : c?.total || 0, cashReceived: methods[i] === 'dinheiro' ? (parseCents(cash[i]) ?? -1) / 100 : undefined, receivedConfirmed: true }));
  const validation = paymentError(c?.total, parts), prepared = !dirty && existing.length > 0;
  const save = async () => {
    if (saveLock.current || completion.busy || d?.phase !== 'draft') return;
    if (validation) { setError(validation); return; }
    saveLock.current = true; setSaving(true);
    try {
      await pendingClear.current;
      await completion.preparePayment(parts);
      if (active.current) { setDirty(false); onEditingChange(false); cleared.current = false; setError(''); }
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'O recebimento não foi salvo.'); }
    finally { saveLock.current = false; if (active.current) setSaving(false); }
  };
  const changeAmount = (i: number, text: string) => {
    edit(); setAmounts(old => { const next = [...old]; next[i] = text; const cents = parseCents(text); if (i === 0 && cents != null && c?.total != null) next[1] = moneyText(Math.max(0, Math.round(c.total * 100) - cents) / 100); return next; });
  };
  const locked = saving || d?.phase !== 'draft';
  return <View style={{ gap: 12, marginTop: 13 }}>
    {(split ? [0, 1] : [0]).map(i => <View key={i} style={{ gap: 9, padding: split ? 11 : 0, borderRadius: 13, backgroundColor: split ? colors.soft : undefined }}>
      {split && <Text style={[type.small, { color: colors.ink, fontWeight: '800' }]}>Parte {i + 1}</Text>}
      <View pointerEvents={locked ? 'none' : 'auto'}><PaymentMethodSelect label={split ? `Forma de pagamento da parte ${i + 1}` : 'Forma de pagamento'} value={methods[i]} onChange={method => { edit(); setMethods(old => old.map((value, index) => index === i ? method : value)); }} /></View>
      {split && <Field compact label={`Valor da parte ${i + 1}`} value={amounts[i]} inputMode="decimal" keyboardType="decimal-pad" editable={!locked} onChangeText={text => changeAmount(i, text)} />}
      {methods[i] === 'dinheiro' ? <>
        <Field compact label={split ? `Dinheiro recebido na parte ${i + 1}` : 'Dinheiro recebido'} value={cash[i]} inputMode="decimal" keyboardType="decimal-pad" editable={!locked} onChangeText={text => { edit(); setCash(old => old.map((value, index) => index === i ? text : value)); }} />
        <Text style={[type.small, { color: colors.warning }]}>Troco: {money(Math.max(0, (parseCents(cash[i]) || 0) / 100 - parts[i].amount))}</Text>
      </> : <Text style={[type.small, { color: colors.muted }]}>{methods[i] === 'pix' ? 'Confira o crédito na conta da loja.' : 'Confira a aprovação na maquininha.'}</Text>}
    </View>)}
    {split && <Text style={[type.small, { color: validation ? colors.warning : colors.accent }]}>Total das partes: {money(parts.reduce((sum, part) => sum + part.amount, 0))} · pedido: {money(c?.total)}</Text>}
    {prepared ? <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.success, fontWeight: '800' }]}>Recebimento confirmado. Será registrado ao concluir.</Text> : <Button icon={Check} loading={saving} disabled={locked || completion.busy || !!validation} onPress={() => void save()}>{split ? 'Confirmo que recebi as duas partes' : 'Confirmar que recebi'}</Button>}
    {!prepared && validation && <Text style={[type.small, { color: colors.muted }]}>{validation}</Text>}
    <Pressable accessibilityRole="button" disabled={locked || completion.busy} onPress={() => { edit(); setSplit(value => !value); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Shuffle size={16} color={colors.accent} /><Text style={[type.small, { color: colors.accent }]}>{split ? 'Usar uma forma de pagamento' : 'Dividir em duas formas'}</Text></Pressable>
    {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
  </View>;
}

function moneyText(value: number) { return value.toFixed(2).replace('.', ','); }

export function DeliveryProofPanel() {
  const completion = useDeliveryCompletion(), { colors } = useZippyTheme(), d = completion.draft;
  const [photo, setPhoto] = useState<string | null>(null), [saved, setSaved] = useState<string | null>(null), [error, setError] = useState(''), [picking, setPicking] = useState(false);
  const operation = d?.request.operationId, live = useRef(operation); live.current = operation;
  useEffect(() => {
    if (!d?.request.proofId) { setSaved(null); return; }
    let active = true;
    readPendingDeliveryProof(d.context.pedidoId, d.request.proofId).then(uri => { if (active) setSaved(uri); }).catch(() => {});
    return () => { active = false; };
  }, [d?.context.pedidoId, d?.request.proofId]);
  const capture = async (camera: boolean) => {
    if (picking || completion.busy || d?.phase !== 'draft') return;
    const expected = operation; setPicking(true); setError('');
    try { const value = await chooseAccountImage(camera); if (expected === live.current && value) setPhoto(value); }
    catch (failure) { if (expected === live.current) setError(failure instanceof Error ? failure.message : 'Não foi possível capturar a foto.'); }
    finally { if (expected === live.current) setPicking(false); }
  };
  const upload = async () => { const expected = operation; if (photo && await completion.uploadProof(photo) && expected === live.current) setPhoto(null); };
  return <View style={{ gap: 10, marginTop: 12 }}>
    {(photo || saved) && <Image source={{ uri: photo ? `data:image/jpeg;base64,${photo}` : saved! }} style={{ width: '100%', height: 150, borderRadius: 13 }} resizeMode="contain" />}
    {photo ? <><Button icon={Check} loading={completion.busy} onPress={() => void upload()}>Anexar esta foto</Button><Button secondary icon={Camera} disabled={completion.busy} onPress={() => void capture(true)}>Refazer foto</Button></> : <>
      <Button secondary icon={Camera} loading={picking} disabled={completion.busy || d?.phase !== 'draft'} onPress={() => void capture(true)}>{d?.request.proofId ? 'Substituir foto' : 'Fotografar pedido'}</Button>
      <Pressable accessibilityRole="button" disabled={picking || completion.busy} onPress={() => void capture(false)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><ImagePlus size={16} color={colors.accent} /><Text style={[type.small, { color: colors.accent }]}>Escolher foto do aparelho</Text></Pressable>
    </>}
    {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
  </View>;
}
