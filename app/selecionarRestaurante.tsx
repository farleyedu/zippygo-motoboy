import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function SelecionarRestauranteScreen() {
  const router = useRouter();
  const {
    user,
    estabelecimentos,
    estabelecimentoAtual,
    needsEstablishmentSelection,
    isLoading,
    selectEstablishment,
    refreshEstabelecimentos,
  } = useAuth();
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    } else if (!needsEstablishmentSelection && estabelecimentoAtual) {
      router.replace('/');
    }
  }, [user, needsEstablishmentSelection, estabelecimentoAtual]);

  const atualizar = async () => {
    try {
      setLoadingList(true);
      await refreshEstabelecimentos();
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível carregar os restaurantes.');
    } finally {
      setLoadingList(false);
    }
  };

  const escolher = async (estabelecimento: (typeof estabelecimentos)[number]) => {
    const result = await selectEstablishment(estabelecimento);
    if (!result.success) {
      Alert.alert('Não foi possível entrar', result.error ?? 'Tente novamente.');
      return;
    }
    router.replace('/');
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Escolha o restaurante</Text>
        <Text style={styles.subtitle}>Olá, {user.nome}. Onde você vai trabalhar agora?</Text>
      </View>

      {loadingList || isLoading ? (
        <ActivityIndicator size="large" color="#2C79FF" />
      ) : estabelecimentos.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum restaurante vinculado</Text>
          <Text style={styles.emptyText}>
            Peça ao gestor do restaurante para cadastrar seu usuário como motoboy no painel.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={atualizar}>
            <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/solicitarRestaurante' as any)}>
            <Text style={styles.linkButtonText}>Solicitar vínculo a um restaurante</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {estabelecimentos.map((item) => (
            <TouchableOpacity key={item.estabelecimentoId} style={styles.card} onPress={() => escolher(item)}>
              <View style={styles.icon}><Text style={styles.iconText}>R</Text></View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.nome}</Text>
                <Text style={styles.cardSubtitle}>Vínculo de motoboy ativo</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB', padding: 24, justifyContent: 'center' },
  header: { marginBottom: 28 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#6B7280', fontSize: 16, lineHeight: 23 },
  list: { gap: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F0FF', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#2C79FF', fontSize: 20, fontWeight: '800' },
  cardContent: { flex: 1, marginLeft: 14 },
  cardTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  arrow: { color: '#2C79FF', fontSize: 30, fontWeight: '300' },
  emptyBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 22 },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#6B7280', fontSize: 14, lineHeight: 21 },
  secondaryButton: { marginTop: 20, borderRadius: 10, backgroundColor: '#2C79FF', padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#FFF', fontWeight: '700' },
  linkButton: { marginTop: 12, alignItems: 'center', padding: 10 },
  linkButtonText: { color: '#2C79FF', fontWeight: '700' },
});
