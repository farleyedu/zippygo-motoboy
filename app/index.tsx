import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapa from '../components/Mapa';
import ModalConfirmarRota from '../components/ModalConfirmarRota';
import PedidosDraggableList from '../components/PedidosDraggableList';
import { iniciarMonitoramentoLocalizacao, pararMonitoramentoLocalizacao } from '../components/locationSetup';
import { useAuth } from '../src/contexts/AuthContext';
import { useFetchPedidos } from '../hooks/useFetchPedidos';
import {
  clearOperationalSession,
  endOperationalSession,
  getOperationalSession,
  heartbeatOperationalSession,
  queueToPedidos,
  startOperationalSession,
} from '../services/mobileApi';
import {
  clearTrackingMode,
  flushLocationQueue,
  setTrackingMode,
} from '../services/trackingService';

export default function TelaInicialMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, estabelecimentoAtual, isLoading: authLoading, needsEstablishmentSelection } = useAuth();
  const {
    pedidos: pedidosDaFila,
    queue,
    oferta,
    loading,
    error,
    refetch,
    acceptOffer,
    rejectOffer,
    reorderQueue,
  } = useFetchPedidos();
  const [online, setOnline] = useState(false);
  const [activeRoute, setActiveRoute] = useState(false);
  const [organizandoRota, setOrganizandoRota] = useState(false);
  const [pedidosAceitos, setPedidosAceitos] = useState(pedidosDaFila);
  const [offerVisible, setOfferVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (needsEstablishmentSelection && !estabelecimentoAtual) {
      router.replace('/selecionarRestaurante' as any);
    }
  }, [authLoading, user, needsEstablishmentSelection, estabelecimentoAtual, router]);

  useEffect(() => {
    const restoreSession = async () => {
      if (authLoading || !user || !estabelecimentoAtual) return;
      try {
        const session = await getOperationalSession();
        if (session && !session.isEnded) {
          await setTrackingMode('online_idle');
          const started = await iniciarMonitoramentoLocalizacao('online_idle');
          setOnline(started);
          if (started) await refetch();
        }
      } catch {
        await clearOperationalSession();
      }
    };
    restoreSession();
  }, [authLoading, user, estabelecimentoAtual, refetch]);

  useEffect(() => {
    setPedidosAceitos(pedidosDaFila);
    if (queue?.current) setActiveRoute(true);
    if (!queue?.current && activeRoute && !queue?.next?.length) setActiveRoute(false);
    if (oferta && online && !activeRoute && !organizandoRota) setOfferVisible(true);
  }, [pedidosDaFila, queue, oferta, online, activeRoute, organizandoRota]);

  useFocusEffect(useCallback(() => {
    refetch();
  }, [refetch]));

  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      refetch();
    }, 15000);
    return () => clearInterval(interval);
  }, [online, refetch]);

  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      heartbeatOperationalSession().catch((caught) => {
        console.warn('[SESSION] Falha no heartbeat operacional:', caught);
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [online]);

  const ficarOnline = async () => {
    try {
      setBusy(true);
      await startOperationalSession();
      await setTrackingMode('online_idle');
      const started = await iniciarMonitoramentoLocalizacao('online_idle');
      if (!started) {
        await endOperationalSession('location_permission_denied');
        Alert.alert('Localização necessária', 'Permita o acesso à localização para ficar online.');
        return;
      }
      setOnline(true);
      await refetch();
    } catch (caught: any) {
      await clearOperationalSession();
      Alert.alert('Não foi possível ficar online', caught?.message ?? 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const ficarOffline = async () => {
    if (activeRoute || queue?.current) {
      Alert.alert('Ação não permitida', 'Finalize a entrega atual antes de ficar offline.');
      return;
    }
    try {
      setBusy(true);
      await flushLocationQueue();
      await pararMonitoramentoLocalizacao();
      await endOperationalSession('motoboy_offline');
    } catch (caught: any) {
      Alert.alert('Erro ao ficar offline', caught?.message ?? 'Tente novamente.');
    } finally {
      await clearTrackingMode();
      setOnline(false);
      setOfferVisible(false);
      setOrganizandoRota(false);
      setBusy(false);
      await refetch();
    }
  };

  const aceitarOferta = async () => {
    try {
      setBusy(true);
      const nextQueue = await acceptOffer();
      setPedidosAceitos(queueToPedidos(nextQueue));
      setOfferVisible(false);
      setOrganizandoRota(true);
    } catch {
      Alert.alert('Oferta indisponível', 'A oferta mudou ou expirou. Atualize a fila.');
    } finally {
      setBusy(false);
    }
  };

  const recusarOferta = async () => {
    try {
      setBusy(true);
      await rejectOffer('recusada_pelo_motoboy');
      setOfferVisible(false);
    } catch (caught: any) {
      Alert.alert('Erro', caught?.message ?? 'Não foi possível recusar a oferta.');
    } finally {
      setBusy(false);
    }
  };

  const iniciarRota = async () => {
    setOrganizandoRota(false);
    setActiveRoute(true);
    await setTrackingMode('active_route');
    await iniciarMonitoramentoLocalizacao('active_route');
  };

  const abrirConfirmacao = () => {
    const current = queue?.current?.pedido;
    if (!current) {
      Alert.alert('Entrega ainda não iniciada', 'A API ainda não marcou um pedido como entrega atual.');
      return;
    }
    router.push({ pathname: '/confirmacaoEntrega', params: { id: String(current.id) } });
  };

  const atualizarOrdem = async (items: typeof pedidosAceitos) => {
    setPedidosAceitos(items);
    if (!activeRoute && items.length > 0) {
      try {
        await reorderQueue(items.map((item) => item.id));
      } catch {
        Alert.alert('Fila alterada', 'A fila foi atualizada por outro usuário.');
        await refetch();
      }
    }
  };

  if (authLoading || !user || !estabelecimentoAtual || needsEstablishmentSelection) return null;

  const lista = activeRoute || organizandoRota ? pedidosAceitos : pedidosDaFila;

  return (
    <View style={styles.container}>
      <Mapa pedidos={lista} emEntrega={activeRoute} recenterToken={0} />

      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <View style={styles.userBox}>
          <Text style={styles.userName}>{user.nome}</Text>
          <Text style={styles.establishmentName}>{estabelecimentoAtual.nome}</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusButton, online ? styles.offlineButton : styles.onlineButton]}
          onPress={online ? ficarOffline : ficarOnline}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.statusText}>{online ? 'Ficar offline' : 'Ficar online'}</Text>}
        </TouchableOpacity>
      </View>

      {online && oferta && !activeRoute && !organizandoRota && (
        <ModalConfirmarRota
          visible={offerVisible}
          onAceitar={aceitarOferta}
          onRecusar={recusarOferta}
          pedidos={queueToPedidos({ ...queue!, current: null, next: [], offer: oferta })}
        />
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>
          {activeRoute ? 'Entrega atual' : organizandoRota ? 'Organize sua rota' : online ? 'Fila do restaurante' : 'Você está offline'}
        </Text>

        {online && loading && <ActivityIndicator color="#2C79FF" />}
        {online && error && <Text style={styles.errorText}>{error}</Text>}
        {online && !loading && !error && lista.length === 0 && (
          <Text style={styles.emptyText}>Nenhum pedido disponível no momento.</Text>
        )}
        {online && lista.length > 0 && (
          <PedidosDraggableList
            pedidos={lista}
            onAtualizarPedidosAceitos={atualizarOrdem}
            dragEnabled={!activeRoute}
          />
        )}

        {online && !activeRoute && organizandoRota && pedidosAceitos.length > 0 && (
          <TouchableOpacity style={styles.primaryButton} onPress={iniciarRota}>
            <Text style={styles.primaryButtonText}>Iniciar rota</Text>
          </TouchableOpacity>
        )}

        {online && activeRoute && queue?.current && (
          <TouchableOpacity style={styles.primaryButton} onPress={abrirConfirmacao}>
            <Text style={styles.primaryButtonText}>Confirmar entrega atual</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  topBar: { position: 'absolute', left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userBox: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, elevation: 3 },
  userName: { color: '#111827', fontSize: 14, fontWeight: '700' },
  establishmentName: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  statusButton: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, elevation: 3 },
  onlineButton: { backgroundColor: '#2C79FF' },
  offlineButton: { backgroundColor: '#EF4444' },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '58%', minHeight: 170, backgroundColor: '#181820', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  panelTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  errorText: { color: '#FCA5A5', textAlign: 'center', marginVertical: 12 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginVertical: 20 },
  primaryButton: { backgroundColor: '#2C79FF', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
});
