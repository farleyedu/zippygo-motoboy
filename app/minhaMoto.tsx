import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bike, Check, FileText, ShieldCheck } from 'lucide-react-native';
import { saveVehicle } from '../services/accountApi';
import { useOwnAccount } from '../src/hooks/useOwnAccount';
import { useAccountSave } from '../src/hooks/useAccountSave';
import { AccountNotice, AccountScreen } from '../src/ui/AccountKit';
import { Button, Feedback, Field, Header, Pill, Surface } from '../src/ui/Kit';
import { useZippyTheme } from '../src/ui/theme';

export default function VehicleScreen() {
  const router = useRouter(), { colors } = useZippyTheme(), data = useOwnAccount(), save = useAccountSave();
  const [modelo, setModelo] = useState(''), [placa, setPlaca] = useState(''), [ano, setAno] = useState(''), [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!data.account) return; setModelo(data.account.modeloMoto || ''); setPlaca(data.account.placaMoto || ''); setAno(data.account.anoMoto ? String(data.account.anoMoto) : ''); }, [data.account]);
  const submit = () => {
    const next: Record<string, string> = {}, cleanPlate = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (modelo.trim().length < 2) next.modelo = 'Informe o modelo da sua moto.';
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(cleanPlate)) next.placa = 'Confira os 7 caracteres da placa.';
    if (!/^\d{4}$/.test(ano) || +ano < 1900 || +ano > new Date().getFullYear() + 1) next.ano = 'Confira o ano da moto.';
    setErrors(next); if (Object.keys(next).length) return;
    void save.run(async () => data.setAccount(await saveVehicle({ modeloMoto: modelo.trim(), placaMoto: cleanPlate, anoMoto: +ano })), 'Sua moto foi atualizada.');
  };
  const blocked = data.loading || !data.account || save.saving;
  return <AccountScreen>
    <Header title="Seu parceiro de caminho." subtitle="Minha moto" onBack={() => router.back()} />
    <Surface hero style={{ alignItems: 'center', padding: 24 }}><Bike size={44} color="#a8c4e9" strokeWidth={1.3} style={{ marginTop: 5, marginBottom: 17 }} /><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 26, letterSpacing: -1, color: colors.heroInk, textAlign: 'center', marginBottom: 6 }}>{data.account?.modeloMoto || 'Sua moto'}</Text><Text style={{ fontFamily: 'Manrope', fontSize: 11, color: colors.heroMuted, marginBottom: 12 }}>{data.account?.anoMoto ? `Modelo ${data.account.anoMoto}` : 'Seu parceiro de entregas'}</Text>{data.account?.placaMoto && <Pill icon={ShieldCheck} inverse>{data.account.placaMoto}</Pill>}</Surface>
    {data.loading && <Feedback title="Carregando sua moto" loading />}{data.error && <Feedback title="Sua moto não carregou" message={data.error} onRetry={() => void data.reload()} />}
    <View style={{ gap: 15, marginTop: 22, marginBottom: 18 }}><Field label="Modelo" value={modelo} onChangeText={setModelo} editable={!blocked} maxLength={120} error={errors.modelo} /><Field label="Placa" value={placa} onChangeText={setPlaca} autoCapitalize="characters" editable={!blocked} maxLength={8} error={errors.placa} /><Field label="Ano" value={ano} onChangeText={setAno} keyboardType="number-pad" editable={!blocked} maxLength={4} error={errors.ano} /></View>
    {save.failure && <Feedback title="Sua moto foi mantida" message={save.failure} />}{save.success && <AccountNotice icon={Check}>{save.success}</AccountNotice>}
    <Button icon={Check} loading={save.saving} disabled={blocked} onPress={submit}>Salvar veículo</Button><View style={{ height: 15 }} /><Button secondary icon={FileText} onPress={() => router.push('/documentos')}>Ver documentos</Button>
  </AccountScreen>;
}
