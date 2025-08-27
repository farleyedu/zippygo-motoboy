import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';

// Tipos já utilizados em ConfirmacaoEntrega
export type MetodoPagamento = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';
export type CodigoStatus = 'pendente' | 'validando' | 'validado' | 'invalido';
export type PagamentoStatus = 'nao_iniciado' | 'em_andamento' | 'confirmado';

interface Pedido {
  id: number;
  cliente: string;
  endereco: string;
  itens: any[];
  valorACobrar: number;
}

export default function EntregaNovaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Monta pedido a partir dos parâmetros
  const pedidoId = parseInt(params.id_ifood as string, 10) || parseInt(params.id_estabelecimento as string, 10) || 0;
  const pedido: Pedido = {
    id: pedidoId,
    cliente: (params.nome as string) || 'Cliente',
    endereco: (params.endereco as string) || 'Endereço',
    itens: params.itens ? JSON.parse(params.itens as string) : [],
    valorACobrar: parseFloat(params.valorTotal as string) || 0,
  };

  const [codigoValor, setCodigoValor] = useState('');
  const [codigoStatus, setCodigoStatus] = useState<CodigoStatus>(
    pedidoId && params.id_ifood && parseInt(params.id_ifood as string, 10) > 0 ? 'pendente' : 'validado'
  );
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>(
    params.statusPagamento === 'pago' ? 'confirmado' : 'nao_iniciado'
  );
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento | undefined>(undefined);

  // Carrega estados salvos
  useEffect(() => {
    (async () => {
      const codigo = await SecureStore.getItemAsync(`codigoConfirmado_${pedido.id}`);
      if (codigo === 'true') {
        setCodigoStatus('validado');
      }
      const pg = await SecureStore.getItemAsync(`pagamentoStatus_${pedido.id}`);
      if (pg === 'confirmado') {
        setPagamentoStatus('confirmado');
      }
    })();
  }, [pedido.id]);

  const validarCodigo = async () => {
    if (codigoValor.trim().length === 0) return;
    setCodigoStatus('validando');
    // Simula validação
    setTimeout(async () => {
      setCodigoStatus('validado');
      await SecureStore.setItemAsync(`codigoConfirmado_${pedido.id}`, 'true');
    }, 800);
  };

  const cobrar = async () => {
    if (!metodoSelecionado) return;
    setPagamentoStatus('confirmado');
    await SecureStore.setItemAsync(`pagamentoStatus_${pedido.id}`, 'confirmado');
  };

  const metodoIcone = (m: MetodoPagamento) => {
    switch (m) {
      case 'Dinheiro':
        return 'cash-outline';
      case 'PIX':
        return 'qr-code-outline';
      case 'Débito':
        return 'card-outline';
      case 'Crédito':
        return 'card-outline';
      default:
        return 'card-outline';
    }
  };

  const valorFormatado = `R$ ${pedido.valorACobrar.toFixed(2).replace('.', ',')}`;

  let footerMsg = 'Aguardando código e pagamento';
  if (codigoStatus !== 'validado' && pagamentoStatus === 'confirmado') {
    footerMsg = 'Aguardando código de entrega';
  } else if (codigoStatus === 'validado' && pagamentoStatus !== 'confirmado') {
    footerMsg = 'Aguardando pagamento';
  } else if (codigoStatus === 'validado' && pagamentoStatus === 'confirmado') {
    footerMsg = 'Tudo pronto';
  }

  const pronto = codigoStatus === 'validado' && pagamentoStatus === 'confirmado';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
<ScrollView contentContainerStyle={{ padding: 16 }}>
<View style={styles.card}>
<Text style={styles.titulo}>{pedido.cliente}</Text>
<Text style={styles.endereco}>{pedido.endereco}</Text>
</View>
{codigoStatus !== 'validado' && (
<View style={styles.chipAviso}>
<Text style={styles.chipAvisoTxt}>Solicite o código de entrega</Text>
</View>
)}

<View style={styles.metaLinha}>
<Text style={styles.metaItem}>ID {pedido.id}</Text>
<Text style={styles.metaItem}>{pedido.itens.length} itens</Text>
</View>

<View style={styles.codigoCard}>
<TextInput
placeholder="Código"
style={[styles.inputCodigo, codigoStatus === 'validado' && styles.inputCodigoDesabilitado]}
editable={codigoStatus !== 'validado'}
value={codigoValor}
onChangeText={setCodigoValor}
/>
{codigoStatus !== 'validado' && (
<TouchableOpacity style={styles.botaoValidar} onPress={validarCodigo}>
<Text style={styles.botaoValidarTxt}>Validar</Text>
</TouchableOpacity>
)}
{codigoStatus === 'validado' && (
<View style={styles.chipCodigo}>
<Text style={styles.chipCodigoTxt}>Código confirmado</Text>
</View>
)}
</View>

<Text style={styles.valorCobrar}>{valorFormatado}</Text>

<View style={styles.metodosLinha}>
{(['Dinheiro', 'PIX', 'Débito', 'Crédito'] as MetodoPagamento[]).map(m => (
<TouchableOpacity
key={m}
style={[styles.metodoChip, metodoSelecionado === m && styles.metodoChipSel]}
onPress={() => setMetodoSelecionado(m)}
>
<Ionicons name={metodoIcone(m)} size={16} color={metodoSelecionado === m ? '#fff' : '#555'} />
<Text style={[styles.metodoTxt, metodoSelecionado === m && styles.metodoTxtSel]}>{m}</Text>
</TouchableOpacity>
))}
</View>

{metodoSelecionado && (
<View style={styles.metodoSelecionadoBox}>
<Ionicons name={metodoIcone(metodoSelecionado)} size={24} color="#fff" />
<Text style={styles.metodoSelecionadoTxt}>{metodoSelecionado}</Text>
</View>
)}

<View style={styles.cobrarLinha}>
<TouchableOpacity
style={[styles.botaoCobrar, !metodoSelecionado && styles.botaoCobrarDesabilitado]}
disabled={!metodoSelecionado}
onPress={cobrar}
>
<Text style={styles.botaoCobrarTxt}>Cobrar {valorFormatado}</Text>
</TouchableOpacity>
<TouchableOpacity
style={styles.dividirLink}
onPress={() =>
router.push({ pathname: '/dividirPagamento', params: { total: String(pedido.valorACobrar), pedidoId: String(pedido.id) } })
}
>
<Ionicons name="calculator-outline" size={20} color="#2C79FF" />
</TouchableOpacity>
</View>
</ScrollView>

<View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
<Text style={[styles.footerMsg, pronto && styles.footerMsgOk]}>{footerMsg}</Text>
<TouchableOpacity
style={[styles.proximaBtn, !pronto && styles.proximaBtnDesabilitada]}
disabled={!pronto}
onPress={() => router.back()}
>
<Text style={[styles.proximaTxt, !pronto && styles.proximaTxtDesabilitada]}>Próxima Entrega</Text>
</TouchableOpacity>
</View>
</View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  endereco: { fontSize: 14, color: '#555', marginTop: 4 },
  chipAviso: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE7E7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  chipAvisoTxt: { fontSize: 12, color: '#C62828' },
  metaLinha: { flexDirection: 'row', marginBottom: 8 },
  metaItem: { fontSize: 12, color: '#666', marginRight: 12 },
  codigoCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  inputCodigo: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputCodigoDesabilitado: { backgroundColor: '#eee' },
  botaoValidar: {
    marginLeft: 8,
    backgroundColor: '#2C79FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  botaoValidarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  chipCodigo: {
    marginLeft: 8,
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chipCodigoTxt: { color: '#fff', fontSize: 12 },
  valorCobrar: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#D32F2F', marginBottom: 16 },
  metodosLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metodoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  metodoChipSel: { backgroundColor: '#2C79FF', borderColor: '#2C79FF' },
  metodoTxt: { fontSize: 12, color: '#555', marginLeft: 4 },
  metodoTxtSel: { color: '#fff' },
  metodoSelecionadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#2C79FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  metodoSelecionadoTxt: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  cobrarLinha: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  botaoCobrar: {
    flex: 1,
    backgroundColor: '#D32F2F',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  botaoCobrarDesabilitado: { backgroundColor: '#ddd' },
  botaoCobrarTxt: { color: '#fff', fontWeight: 'bold' },
  dividirLink: { marginLeft: 12, padding: 8 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  footerMsg: { fontSize: 14, color: '#666', marginBottom: 8 },
  footerMsgOk: { color: '#4caf50' },
  proximaBtn: {
    backgroundColor: '#2C79FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 10,
  },
  proximaBtnDesabilitada: { backgroundColor: '#ccc' },
  proximaTxt: { color: '#fff', fontWeight: 'bold' },
  proximaTxtDesabilitada: { color: '#888' },
});
