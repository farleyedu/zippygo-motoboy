import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { deliverCurrent, getOperationalQueue, MotoboyQueue, queueToPedidos } from '../services/mobileApi';
import { iniciarMonitoramentoLocalizacao } from '../components/locationSetup';
import { setTrackingMode } from '../services/trackingService';

export default function ConfirmacaoEntrega() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [queue, setQueue] = useState<MotoboyQueue | null>(null);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    carregarFila();
  }, [user]);

  const carregarFila = async () => {
    try {
      setLoading(true);
      setQueue(await getOperationalQueue());
    } catch (caught: any) {
      setError(caught?.message ?? 'Não foi possível carregar a entrega.');
    } finally {
      setLoading(false);
    }
  };

  const pedidos = queueToPedidos(queue);
  const pedidoId = Number(params.id ?? 0);
  const pedido = pedidos.find((item) => item.id === pedidoId) ?? pedidos[0];
  const current = queue?.current?.pedido;
  const requiresCode = Boolean(current?.requerCodigoEntrega);

  const confirmar = async () => {
    if (!pedido || !current) {
      Alert.alert('Entrega indisponível', 'A fila não possui uma entrega atual.');
      return;
    }
    if (requiresCode && !codigo.trim()) {
      Alert.alert('Código necessário', 'Informe o código fornecido pelo cliente.');
      return;
    }

    try {
      setConfirmando(true);
      await deliverCurrent(requiresCode ? codigo.trim() : undefined);
      await setTrackingMode('online_idle');
      await iniciarMonitoramentoLocalizacao('online_idle');
      Alert.alert('Entrega confirmada', `Entrega para ${pedido.nomeCliente ?? 'o cliente'} foi registrada.`, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (caught: any) {
      Alert.alert('Não foi possível confirmar', caught?.message ?? 'Verifique o código e tente novamente.');
    } finally {
      setConfirmando(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;
  }
  if (error || !pedido) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Entrega não encontrada.'}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={carregarFila}>
          <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={18} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmar entrega</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <Text style={styles.clientName}>{pedido.nomeCliente ?? 'Não informado'}</Text>
          <Text style={styles.muted}>{pedido.telefoneCliente ?? 'Telefone não informado'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço</Text>
          <Text style={styles.address}>{pedido.enderecoEntrega ?? 'Endereço não informado'}</Text>
          <Text style={styles.muted}>{pedido.bairro ?? ''}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedido #{pedido.id}</Text>
          <Text style={styles.value}>R$ {Number(pedido.valor ?? 0).toFixed(2).replace('.', ',')}</Text>
          <Text style={styles.muted}>Pagamento: {pedido.statusPagamento ?? 'Não informado'}</Text>
          {pedido.observacoes ? <Text style={styles.observations}>{pedido.observacoes}</Text> : null}
        </View>

        {requiresCode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Código do cliente</Text>
            <TextInput
              style={styles.input}
              value={codigo}
              onChangeText={setCodigo}
              placeholder="Digite o código"
              keyboardType="number-pad"
              editable={!confirmando}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.confirmButton, confirmando && styles.disabled]} onPress={confirmar} disabled={confirmando}>
          {confirmando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Confirmar entrega</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F2F2F2' },
  header: { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { padding: 6 },
  headerTitle: { color: '#333', fontSize: 18, fontWeight: '700' },
  placeholder: { width: 30 },
  content: { padding: 20, paddingBottom: 40 },
  section: { backgroundColor: '#FFF', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 1 },
  sectionTitle: { color: '#333', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  clientName: { color: '#333', fontSize: 17, fontWeight: '600' },
  address: { color: '#555', fontSize: 15, lineHeight: 22 },
  muted: { color: '#777', fontSize: 13, marginTop: 4 },
  value: { color: '#2E7D32', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  observations: { color: '#666', fontSize: 13, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 18, backgroundColor: '#FFF' },
  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  confirmButton: { backgroundColor: '#2E7D32', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  disabled: { backgroundColor: '#A5D6A7' },
  confirmText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#D32F2F', textAlign: 'center', fontSize: 16 },
  secondaryButton: { backgroundColor: '#2E7D32', padding: 12, borderRadius: 8, marginTop: 18 },
  secondaryButtonText: { color: '#FFF', fontWeight: '700' },
  linkButton: { marginTop: 14 },
  linkText: { color: '#2E7D32', fontWeight: '700' },
});
