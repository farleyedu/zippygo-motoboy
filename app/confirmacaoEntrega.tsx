import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../utils/secureStorage';
import { useFetchPedidoById } from '../hooks/useFetchPedidos';

interface PedidoEntrega {
  id: number;
  cliente: string;
  endereco: string;
  bairro: string;
  valor: number;
  formaPagamento: string;
  observacoes?: string;
  codigoEntrega?: string;
}

export default function ConfirmacaoEntrega() {
  const router = useRouter();
  const { user } = useAuth();
  const [pedido, setPedido] = useState<PedidoEntrega | null>(null);
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  
  // Hook para buscar dados reais do pedido da API
  const { pedido: pedidoAPI, loading: loadingAPI, error: errorAPI, refetch } = useFetchPedidoById(pedidoId);

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
  }, [user]);

  // Carrega ID do pedido e dados do pedido em entrega
  useEffect(() => {
    carregarPedidoEntrega();
  }, []);
  
  // Atualiza dados do pedido quando a API retorna
  useEffect(() => {
    if (pedidoAPI) {
      const pedidoFormatado: PedidoEntrega = {
        id: pedidoAPI.id,
        cliente: pedidoAPI.nomeCliente || pedidoAPI.cliente_nome || '',
        endereco: pedidoAPI.endereco || pedidoAPI.enderecoEntrega || '',
        bairro: pedidoAPI.bairro || '',
        valor: pedidoAPI.valor || pedidoAPI.total_valor || 0,
        formaPagamento: 'Pix',
        observacoes: 'Sem observações',
        codigoEntrega: '1234',
      };
      setPedido(pedidoFormatado);
    }
  }, [pedidoAPI]);

  const carregarPedidoEntrega = async () => {
    try {
      const pedidoData = await getSecureItem('pedidoAtual');
      
      if (pedidoData) {
        const pedidoObj = JSON.parse(pedidoData);
        // Extrai o ID do pedido para buscar dados reais da API
        const id = pedidoObj.id;
        if (id) {
          setPedidoId(id);
        } else {
          // Fallback para dados do SecureStore se não houver ID
          setPedido(pedidoObj);
        }
      } else {
        // Se não há pedido, volta para tela inicial
        Alert.alert('Aviso', 'Nenhum pedido em entrega encontrado.');
        router.replace('/');
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      Alert.alert('Erro', 'Erro ao carregar dados do pedido.');
    }
  };

  const confirmarEntrega = async () => {
    if (!pedido || !user) return;

    try {
      setConfirmando(true);
      
      // Simula confirmação da entrega
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Remove pedido atual do storage
      await deleteSecureItem('pedidoAtual');
      await deleteSecureItem('emEntrega');
      
      // Salva no histórico de entregas
      const historicoData = await getSecureItem('historicoEntregas');
      const historico = historicoData ? JSON.parse(historicoData) : [];
      
      const entregaConfirmada = {
        ...pedido,
        dataEntrega: new Date().toISOString(),
        motoboyId: user.id,
        motoboyNome: user.nome,
        status: 'entregue'
      };
      
      historico.push(entregaConfirmada);
      await setSecureItem('historicoEntregas', JSON.stringify(historico));
      
      Alert.alert(
        'Entrega Confirmada!',
        `Entrega para ${pedido.cliente} foi confirmada com sucesso.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/')
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao confirmar entrega:', error);
      Alert.alert('Erro', 'Erro ao confirmar entrega. Tente novamente.');
    } finally {
      setConfirmando(false);
    }
  };

  const voltarParaMapa = () => {
    router.back();
  };

  if (!user) {
    return null; // Aguarda redirecionamento
  }

  // Renderização de loading
  if (loadingAPI && !pedido) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Carregando pedido...</Text>
      </View>
    );
  }

  // Renderização de erro da API
  if (errorAPI && !pedido) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={voltarParaMapa} style={styles.backIcon}>
            <FontAwesome name="arrow-left" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Erro ao Carregar</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>Erro ao carregar dados do pedido</Text>
          <TouchableOpacity style={styles.backButton} onPress={refetch}>
            <Text style={styles.backButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={voltarParaMapa}>
            <Text style={styles.backButtonText}>Voltar ao Mapa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Renderização de erro geral
  if (!pedido) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Pedido não encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={voltarParaMapa}>
          <Text style={styles.backButtonText}>Voltar ao Mapa</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={voltarParaMapa} style={styles.backIcon}>
          <FontAwesome name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ENTREGA</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Endereço de entrega */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço de entrega</Text>
          <Text style={styles.address}>{pedido.endereco}</Text>
          <Text style={styles.neighborhood}>{pedido.bairro}</Text>
          
          <TouchableOpacity style={styles.mapButton}>
            <FontAwesome name="map" size={16} color="#2E7D32" />
            <Text style={styles.mapButtonText}>Mapa</Text>
          </TouchableOpacity>
        </View>

        {/* Informações do cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <Text style={styles.clientName}>{pedido.cliente}</Text>
          <Text style={styles.neighborhood}>{pedido.bairro}</Text>
          
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <FontAwesome name="check-circle" size={14} color="#4CAF50" />
              <Text style={[styles.statusText, { color: '#4CAF50' }]}>Validado</Text>
            </View>
            
            <View style={styles.statusItem}>
              <FontAwesome name="money" size={14} color="#D32F2F" />
              <Text style={[styles.statusText, { color: '#D32F2F' }]}>Cobrar</Text>
            </View>
          </View>
        </View>

        {/* Detalhes do pedido */}
        <View style={styles.section}>
          <Text style={styles.orderTitle}>Pedido - {pedido.cliente}</Text>
          <Text style={styles.orderValue}>Valor: R$ {pedido.valor.toFixed(2)}</Text>
          <Text style={styles.paymentMethod}>Pagamento: {pedido.formaPagamento}</Text>
          
          {pedido.observacoes && (
            <Text style={styles.observations}>Obs: {pedido.observacoes}</Text>
          )}
          
          {pedido.codigoEntrega && (
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Código de entrega:</Text>
              <Text style={styles.codeValue}>{pedido.codigoEntrega}</Text>
            </View>
          )}
        </View>

        {/* Informações do motoboy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motoboy</Text>
          <Text style={styles.motoboyName}>{user.nome}</Text>
          <Text style={styles.motoboyEmail}>{user.email}</Text>
        </View>
      </ScrollView>

      {/* Botão de confirmação */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.confirmButton, confirmando && styles.confirmButtonDisabled]} 
          onPress={confirmarEntrega}
          disabled={confirmando}
        >
          {confirmando ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirmar Entrega</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backIcon: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  placeholder: {
    width: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#FFF',
    marginVertical: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  neighborhood: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F5E8',
    borderRadius: 15,
  },
  mapButtonText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statusText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  observations: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  codeSection: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  codeLabel: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: 'bold',
  },
  codeValue: {
    fontSize: 16,
    color: '#E65100',
    fontWeight: 'bold',
    marginTop: 2,
  },
  motoboyName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  motoboyEmail: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  confirmButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 50,
  },
  backButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    alignSelf: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});