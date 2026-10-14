import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Check, ImagePlus, Pencil, ShieldCheck, Shuffle } from 'lucide-react-native';
import { useDeliveryCompletion } from '../contexts/DeliveryCompletionContext';
import { parseCents, paymentError } from '../delivery/completionRules';
import type { PaymentMethod, PaymentPart } from '../../services/completionApi';
import { readPendingDeliveryProof } from '../../services/completionApi';
import { chooseAccountImage } from '../../services/accountImage';
import { Button, Field, type } from './Kit';
import { methodNames, money } from './CompletionKit';
import { AccountNotice } from './AccountKit';
import { ChangeCard, methodIcon, MethodGrid, MoneyInput, moneyText, QuickCash, useChargeTone } from './ChargeKit';
import { useZippyTheme } from './theme';
import { officialCompletion,officialPaymentPlan } from '../delivery/ifoodRules';
import { OfficialDeliveryCode } from './OfficialDeliveryCode';

export function DeliveryCodePanel() {
  const completion=useDeliveryCompletion();
  return completion.draft && officialCompletion(completion.draft.context) ? <OfficialDeliveryCode/> : <LocalDeliveryCodePanel/>;
}
function LocalDeliveryCodePanel() {
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
  const completion=useDeliveryCompletion();
  return completion.draft && officialCompletion(completion.draft.context) ? <OfficialPaymentPanel onEditingChange={onEditingChange}/> : <LocalDeliveryPaymentPanel initiallySplit={initiallySplit} onEditingChange={onEditingChange}/>;
}
function OfficialPaymentPanel({onEditingChange}:{onEditingChange:(editing:boolean)=>void}) {
  const completion=useDeliveryCompletion(),d=completion.draft,{colors}=useChargeTone();
  const plan=d ? officialPaymentPlan(d.context) : {parts:[],error:'Confira sua entrega atual.'};
  const [cash,setCash]=useState<string[]>(()=>plan.parts.map(p=>{const existing=d?.request.payments.find(a=>a.method===p.method);return existing?.cashReceived==null?'':moneyText(existing.cashReceived);}));
  const [error,setError]=useState(''),[saving,setSaving]=useState(false);
  const parts:PaymentPart[]=plan.parts.map((p,i)=>({method:p.method,amount:p.amount,receivedConfirmed:true,cashReceived:p.method==='dinheiro'?(parseCents(cash[i] || '') ?? -1)/100:undefined}));
  const prepared=!!d?.request.payments.length,locked=d?.phase!=='draft'||completion.busy||saving;
  const validation=plan.error || paymentError(d?.context.total,parts);
  const save=async()=>{if(locked||validation)return;setSaving(true);try{await completion.preparePayment(parts);onEditingChange(false);setError('');}catch(e){setError(e instanceof Error?e.message:'Confira o recebimento.');}finally{setSaving(false);}};
  const edit=async()=>{if(locked)return;setSaving(true);try{await completion.preparePayment([]);onEditingChange(true);}catch(e){setError(e instanceof Error?e.message:'Não foi possível revisar o recebimento.');}finally{setSaving(false);}};
  return <View style={{gap:12,marginTop:13}}>
    <Text style={[type.small,{color:colors.muted}]}>Receba somente o saldo e os meios informados pelo iFood.</Text>
    {plan.error ? <Text style={[type.small,{color:colors.danger}]}>{plan.error}</Text> : prepared ? <>
      {d!.request.payments.map((part,i)=><PreparedPart key={i} part={part}/>)}
      <AccountNotice icon={ShieldCheck}>Recebimento conferido. Não cobre novamente enquanto aguarda a confirmação.</AccountNotice>
      <Button secondary icon={Pencil} disabled={locked} onPress={()=>void edit()}>Revisar recebimento</Button>
    </> : <>
      {plan.parts.map((part,i)=><View key={part.method} style={{gap:10}}>
        <Text style={{fontFamily:'ManropeExtraBold',fontSize:14,color:colors.ink}}>{methodNames[part.method]} · {money(part.amount)}</Text>
        {part.method==='dinheiro' ? <>
          {part.changeFor!=null && <Text style={[type.small,{color:colors.muted}]}>Troco solicitado para {money(part.changeFor)}. Confira o dinheiro recebido.</Text>}
          <MoneyInput label="Dinheiro recebido" value={cash[i] || ''} editable={!locked} onChange={text=>{setCash(old=>{const next=[...old];next[i]=text;return next;});onEditingChange(true);}}/>
          <ChangeCard received={parseCents(cash[i] || '')==null?null:parseCents(cash[i])!/100} due={part.amount}/>
        </> : <AccountNotice icon={ShieldCheck} warning>{part.method==='pix'?'Confira o crédito na conta da loja.':'Confira a aprovação na maquininha.'}</AccountNotice>}
      </View>)}
      <Button icon={Check} loading={saving} disabled={locked||!!validation} onPress={()=>void save()}>Confirmar que recebi o saldo</Button>
    </>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={[type.small,{color:colors.danger}]}>{error}</Text>}
  </View>;
}
function LocalDeliveryPaymentPanel({ initiallySplit = false, onEditingChange }: { initiallySplit?: boolean; onEditingChange: (editing: boolean) => void }) {
  const completion = useDeliveryCompletion(), d = completion.draft, c = d?.context, tone = useChargeTone(), { colors } = tone;
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
  const total = c?.total || 0, indexes = split ? [0, 1] : [0];
  const parts: PaymentPart[] = indexes.map(i => ({ method: methods[i], amount: split ? (parseCents(amounts[i]) ?? 0) / 100 : total, cashReceived: methods[i] === 'dinheiro' ? (parseCents(cash[i]) ?? -1) / 100 : undefined, receivedConfirmed: true }));
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
  const changeMethod = (i: number, method: PaymentMethod) => { edit(); setMethods(old => old.map((value, index) => index === i ? method : value)); };
  const changeCash = (i: number, text: string) => { edit(); setCash(old => old.map((value, index) => index === i ? text : value)); };
  const locked = saving || d?.phase !== 'draft';
  const paid = parts.reduce((sum, part) => sum + Math.round(part.amount * 100), 0), due = Math.round(total * 100);

  if (prepared) return <View style={{ gap: 12, marginTop: 13 }}>
    {existing.map((part, i) => <PreparedPart key={i} part={part} label={existing.length > 1 ? `Parte ${i + 1}` : undefined} />)}
    <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.success, fontWeight: '800' }]}>Recebimento confirmado. Será registrado ao concluir.</Text>
    <Pressable accessibilityRole="button" disabled={locked || completion.busy} onPress={edit} hitSlop={6} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: locked ? .5 : 1 }}><Pencil size={15} color={colors.accent} /><Text style={[type.small, { color: colors.accent, fontWeight: '800' }]}>Alterar recebimento</Text></Pressable>
    {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
  </View>;

  return <View style={{ gap: 14, marginTop: 13 }}>
    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Text style={[type.eyebrow, { color: colors.muted }]}>TOTAL A RECEBER</Text>
      <Text accessibilityLabel={`Total a receber ${money(total)}`} style={{ fontFamily: 'ManropeExtraBold', fontSize: split ? 28 : 38, letterSpacing: -1.8, color: colors.ink, marginTop: 4 }}>{money(total)}</Text>
    </View>
    {split && <SplitProgress paid={paid} due={due} />}
    {indexes.map(i => {
      const amount = parts[i].amount, cents = parseCents(cash[i]), received = cents == null ? null : cents / 100;
      const body = <View style={{ gap: 11 }}>
        {split && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>Parte {i + 1}</Text><Text style={[type.small, { color: colors.muted }]}>{money(amount)}</Text></View>}
        <MethodGrid compact={split} disabled={locked} label={split ? `Forma de pagamento da parte ${i + 1}` : 'Forma de pagamento'} value={methods[i]} onChange={method => changeMethod(i, method)} />
        {split && <MoneyInput label={`Valor da parte ${i + 1}`} value={amounts[i]} editable={!locked} onChange={text => changeAmount(i, text)} />}
        {methods[i] === 'dinheiro' ? <>
          {amount > 0 && <QuickCash total={amount} selected={received} disabled={locked} onPick={value => changeCash(i, moneyText(value))} />}
          <MoneyInput big={!split} label={split ? `Dinheiro recebido na parte ${i + 1}` : 'Dinheiro recebido'} value={cash[i]} editable={!locked} error={received != null && received + .004 < amount} onChange={text => changeCash(i, text)} />
          <ChangeCard compact={split} received={received} due={amount} />
        </> : <AccountNotice icon={ShieldCheck} warning>{methods[i] === 'pix' ? 'Confira o crédito na conta da loja. Uma imagem do cliente não confirma recebimento.' : 'Confira a aprovação na maquininha antes de continuar.'}</AccountNotice>}
      </View>;
      return split ? <View key={i} style={{ padding: 14, borderRadius: 19, borderWidth: 1, borderColor: tone.part.border, backgroundColor: tone.part.background }}>{body}</View> : <View key={i}>{body}</View>;
    })}
    <Button icon={Check} loading={saving} disabled={locked || completion.busy || !!validation} onPress={() => void save()}>{split ? 'Confirmo que recebi as duas partes' : 'Confirmar que recebi'}</Button>
    {dirty && !!validation && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{validation}</Text>}
    <Pressable accessibilityRole="button" disabled={locked || completion.busy} onPress={() => { edit(); setSplit(value => !value); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Shuffle size={16} color={colors.accent} /><Text style={[type.small, { color: colors.accent }]}>{split ? 'Usar uma forma de pagamento' : 'Dividir em duas formas'}</Text></Pressable>
    {!!error && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>{error}</Text>}
  </View>;
}

function PreparedPart({ part, label }: { part: PaymentPart; label?: string }) {
  const tone = useChargeTone(), { colors } = tone, Icon = methodIcon(part.method);
  const change = part.method === 'dinheiro' && part.cashReceived != null ? Math.max(0, part.cashReceived - part.amount) : 0;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: tone.active.border, backgroundColor: tone.active.background }}>
    <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Icon size={18} color={colors.card} /></View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 12, color: colors.ink }}>{label ? `${label} · ` : ''}{methodNames[part.method]}</Text>
      {part.method === 'dinheiro' && part.cashReceived != null && <Text style={[type.small, { color: colors.muted, fontSize: 10 }]}>{`Recebido ${money(part.cashReceived)} · ${change > 0 ? `troco ${money(change)}` : 'sem troco'}`}</Text>}
    </View>
    <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 15, letterSpacing: -.4, color: colors.ink }}>{money(part.amount)}</Text>
  </View>;
}

function SplitProgress({ paid, due }: { paid: number; due: number }) {
  const tone = useChargeTone(), { colors } = tone, diff = due - paid, exact = diff === 0 && due > 0;
  const ink = exact ? colors.success : diff < 0 ? colors.danger : tone.summary.ink;
  return <View accessibilityLiveRegion="polite" style={{ gap: 9, padding: 14, borderRadius: 14, backgroundColor: tone.summary.background }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Text style={[type.small, { color: tone.summary.ink, fontSize: 11 }]}>Distribuído {money(paid / 100)}</Text>
      <Text style={[type.small, { color: ink, fontWeight: '800', fontSize: 11 }]}>{exact ? 'Total certo' : diff < 0 ? `Passou ${money(-diff / 100)}` : `Falta ${money(diff / 100)}`}</Text>
    </View>
    <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: tone.idle.border }}><View style={{ width: `${due ? Math.min(100, Math.round(paid * 100 / due)) : 0}%`, height: 6, borderRadius: 3, backgroundColor: exact ? colors.success : diff < 0 ? colors.danger : colors.accent }} /></View>
  </View>;
}

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
