import React from 'react';
import { Text, View } from 'react-native';
import { Wallet } from 'lucide-react-native';
import type { RouteStop } from '../../services/mobileApi';
import { payModes } from '../../services/workApi';
import { AccountNotice } from './AccountKit';
import { SectionTitle, money, type } from './Kit';
import { WorkPair } from './WorkKit';
import { useZippyTheme } from './theme';

export function OfferEarnings({ stops }: { stops: RouteStop[] }) {
  const { colors } = useZippyTheme();
  const allDelivery = stops.length > 0 && stops.every(s => s.earnings && ['delivery', 'distance'].includes(s.earnings.mode) && s.earnings.amount != null);
  const total = allDelivery ? stops.reduce((sum, s) => sum + Math.round(s.earnings!.amount! * 100), 0) / 100 : null;
  return <View><SectionTitle>Quanto você vai ganhar</SectionTitle>{total != null && <WorkPair label="Total das entregas desta oferta" value={money(total)} />}{stops.map(s => <View key={s.pedidoId}><WorkPair label={`Pedido #${s.pedidoId}`} value={!s.earnings ? 'Remuneração indisponível' : ['delivery', 'distance'].includes(s.earnings.mode) ? money(s.earnings.amount) : `${money(s.earnings.rate)} ${payModes[s.earnings.mode]}`} />{s.earnings?.mode === 'distance' && <Text style={[type.small, { color: colors.muted }]}>{s.earnings.distanceKm?.toLocaleString('pt-BR')} km em linha reta · {money(s.earnings.rate)}/km</Text>}</View>)}<AccountNotice icon={Wallet}>{allDelivery ? 'O total é a soma das entregas, não uma remuneração por rota. Esses valores ficam registrados e só geram ganho ao concluir cada entrega.' : 'Pagamento por período não tem ganho adicional por entrega. Confira a regra de cada pedido; valores ausentes precisam ser esclarecidos com a loja.'}</AccountNotice></View>;
}
