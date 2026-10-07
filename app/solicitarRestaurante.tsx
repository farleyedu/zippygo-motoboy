import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import {
  listAvailableEstablishments,
  listMotoboyLinkRequests,
  MotoboyAvailableEstablishment,
  MotoboyLinkRequest,
  acceptMotoboyInvite,
  rejectMotoboyInvite,
  requestMotoboyLink,
} from '../services/mobileApi';

export default function SolicitarRestauranteScreen() {
  const router = useRouter();
  const { user, refreshEstabelecimentos, estabelecimentos, estabelecimentoAtual, selectEstablishment } = useAuth();
  const [restaurants, setRestaurants] = useState<MotoboyAvailableEstablishment[]>([]);
  const [requests, setRequests] = useState<MotoboyLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [available, mine] = await Promise.all([listAvailableEstablishments(), listMotoboyLinkRequests()]);
    const deliveryEstablishments = available.filter((item) =>
      (item.modulosAtivos ?? []).some((module) => String(module).toUpperCase() === 'DELIVERY'),
    );
    setRestaurants(deliveryEstablishments);
    setRequests(mine);
  }, []);

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    load().catch((error: any) => Alert.alert('Erro', error?.message ?? 'Não foi possível carregar os restaurantes.')).finally(() => setLoading(false));
  }, [user, router, load]);

  const atualizar = async () => {
    try {
      setRefreshing(true);
      await load();
      const links = await refreshEstabelecimentos();
      if (links.length === 1) {
        const result = await selectEstablishment(links[0]);
        if (result.success) router.replace('/');
      } else if (links.length > 1) {
        router.replace('/selecionarRestaurante');
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível atualizar suas solicitações.');
    } finally {
      setRefreshing(false);
    }
  };

  const solicitar = async (id: string) => {
    try {
      setBusyId(id);
      await requestMotoboyLink(id);
      await load();
      Alert.alert('Solicitação enviada', 'O restaurante foi notificado. Aguarde a aprovação do gestor.');
    } catch (error: any) {
      Alert.alert('Não foi possível solicitar', error?.message ?? 'Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const responderConvite = async (request: MotoboyLinkRequest, aceitar: boolean) => {
    try {
      setBusyId(request.id);
      if (aceitar) await acceptMotoboyInvite(request.id);
      else await rejectMotoboyInvite(request.id);
      await load();
      if (aceitar) {
        const links = await refreshEstabelecimentos();
        if (links.length === 1) {
          const result = await selectEstablishment(links[0]);
          if (result.success) router.replace('/');
        }
      }
      Alert.alert(aceitar ? 'Convite aceito' : 'Convite recusado', aceitar ? 'Agora você está vinculado ao restaurante.' : 'O convite foi recusado.');
    } catch (error: any) {
      Alert.alert(aceitar ? 'Não foi possível aceitar' : 'Não foi possível recusar', error?.message ?? 'Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const escolherRestaurante = async (restaurant: MotoboyAvailableEstablishment) => {
    try {
      setBusyId(restaurant.id);
      const result = await selectEstablishment({
        estabelecimentoId: restaurant.id,
        nome: restaurant.nome,
        tipoEstabelecimento: restaurant.tipoEstabelecimento,
        statusVinculo: 'ativo',
        statusEstabelecimento: 'ativo',
        tipoAcesso: 'motoboy',
        modulosAtivos: restaurant.modulosAtivos ?? [],
      });
      if (!result.success) {
        Alert.alert('Não foi possível selecionar', result.error ?? 'Tente novamente.');
        return;
      }
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Não foi possível selecionar', error?.message ?? 'Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const requestFor = (id: string) => requests.find((item) => item.estabelecimentoId === id);

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={atualizar} />}>
        <Text style={styles.title}>Vincular a um restaurante</Text>
        <Text style={styles.subtitle}>Escolha uma loja e envie uma solicitação. O gestor precisa aprovar antes de você iniciar entregas.</Text>

        {loading ? <ActivityIndicator size="large" color="#2C79FF" /> : restaurants.map((restaurant) => {
          const request = requestFor(restaurant.id);
          const pending = request?.status === 'pending';
          const approved = request?.status === 'approved' || estabelecimentos.some((item) => item.estabelecimentoId === restaurant.id);
          const rejected = request?.status === 'rejected';
          const invitation = pending && request?.origem === 'estabelecimento';
          const currentEstablishmentId = estabelecimentoAtual && 'estabelecimentoId' in estabelecimentoAtual ? estabelecimentoAtual.estabelecimentoId : estabelecimentoAtual?.id;
          const selected = currentEstablishmentId === restaurant.id;
          return (
            <View key={restaurant.id} style={styles.card}>
              <View style={styles.cardMain}>
                <View style={styles.icon}><Text style={styles.iconText}>R</Text></View>
                <View style={styles.cardText}>
                  <Text style={styles.restaurantName}>{restaurant.nome}</Text>
                  <Text style={styles.location}>{[restaurant.cidade, restaurant.uf].filter(Boolean).join(' - ') || 'Restaurante disponível'}</Text>
                </View>
              </View>
              {approved ? (
                <View style={styles.approvedActions}>
                  <Text style={styles.approved}>{selected ? 'Restaurante selecionado' : 'Vínculo aprovado'}</Text>
                  <TouchableOpacity style={styles.button} onPress={() => void escolherRestaurante(restaurant)} disabled={busyId === restaurant.id || selected}>
                    {busyId === restaurant.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{selected ? 'Selecionado' : 'Escolher restaurante'}</Text>}
                  </TouchableOpacity>
                </View>
              ) : invitation ? (
                <View style={styles.inviteActions}>
                  <Text style={styles.inviteText}>O restaurante enviou um convite</Text>
                  <View style={styles.inviteButtons}>
                    <TouchableOpacity style={styles.button} onPress={() => void responderConvite(request, true)} disabled={busyId === request.id}>
                      {busyId === request.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Aceitar</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => void responderConvite(request, false)} disabled={busyId === request.id}>
                      <Text style={styles.secondaryTextSmall}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : pending ? <Text style={styles.pending}>Aguardando aprovação</Text> : (
                <TouchableOpacity style={styles.button} onPress={() => solicitar(restaurant.id)} disabled={busyId === restaurant.id}>
                  {busyId === restaurant.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{rejected ? 'Solicitar novamente' : 'Solicitar vínculo'}</Text>}
                </TouchableOpacity>
              )}
              {rejected && request?.rejectionReason ? <Text style={styles.reason}>Motivo: {request.rejectionReason}</Text> : null}
            </View>
          );
        })}

        {!loading && restaurants.length === 0 && <Text style={styles.empty}>Nenhum restaurante disponível no momento.</Text>}
        <TouchableOpacity style={styles.secondaryButton} onPress={atualizar} disabled={refreshing}>
          <Text style={styles.secondaryText}>Atualizar status</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.logoutText}>Voltar para o login</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { flexGrow: 1, padding: 24, paddingTop: 56 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#6B7280', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  card: { backgroundColor: '#FFF', borderRadius: 16, elevation: 2, marginBottom: 12, padding: 16 },
  cardMain: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  icon: { alignItems: 'center', backgroundColor: '#E8F0FF', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  iconText: { color: '#2C79FF', fontSize: 20, fontWeight: '800' },
  cardText: { flex: 1, marginLeft: 12 },
  restaurantName: { color: '#111827', fontSize: 16, fontWeight: '800' },
  location: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  button: { alignItems: 'center', backgroundColor: '#2C79FF', borderRadius: 10, padding: 12 },
  buttonText: { color: '#FFF', fontWeight: '800' },
  pending: { color: '#B45309', fontSize: 14, fontWeight: '800' },
  inviteActions: { marginTop: 2 },
  inviteText: { color: '#1D4ED8', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  inviteButtons: { flexDirection: 'row', gap: 8 },
  secondaryButtonSmall: { alignItems: 'center', borderColor: '#9CA3AF', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', padding: 12 },
  secondaryTextSmall: { color: '#4B5563', fontWeight: '800' },
  approved: { color: '#15803D', fontSize: 14, fontWeight: '800' },
  approvedActions: { gap: 10 },
  rejected: { color: '#B91C1C', fontSize: 14, fontWeight: '800' },
  reason: { color: '#6B7280', fontSize: 12, marginTop: 6 },
  empty: { color: '#6B7280', marginTop: 24, textAlign: 'center' },
  secondaryButton: { alignItems: 'center', borderColor: '#2C79FF', borderRadius: 10, borderWidth: 1, marginTop: 10, padding: 13 },
  secondaryText: { color: '#2C79FF', fontWeight: '800' },
  logoutText: { color: '#6B7280', fontSize: 14, marginTop: 20, textAlign: 'center' },
});
