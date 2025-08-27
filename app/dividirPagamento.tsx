import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

type MetodoPagamento = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito' | 'Outros';

interface Parcela {
  id: string;
  metodo: MetodoPagamento;
  valor: number;
  trocoPara?: number;
  confirmado?: boolean;
  observacao?: string;
}

export default function DividirPagamento() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const total = parseFloat(params.total as string) || 0;
  const pedidoId = params.pedidoId as string;
  
  const [parcelas, setParcelas] = useState<Parcela[]>([
    {
      id: '1',
      metodo: 'Dinheiro',
      valor: 0,
    }
  ]);
  
  const [restante, setRestante] = useState(total);
  const [soma, setSoma] = useState(0);

  // Calcula soma e restante sempre que parcelas mudam
  useEffect(() => {
    const novaSoma = parcelas.reduce((acc, parcela) => acc + parcela.valor, 0);
    setSoma(novaSoma);
    setRestante(total - novaSoma);
  }, [parcelas, total]);

  // Valida se pode confirmar
  const podeConfirmar = () => {
    if (Math.abs(restante) > 0.01) return false; // Soma deve ser exatamente igual ao total
    if (parcelas.some(p => p.valor < 0.5)) return false; // Cada valor >= R$ 0,50
    if (parcelas.some(p => (p.metodo === 'PIX' || p.metodo === 'Débito' || p.metodo === 'Crédito') && !p.confirmado)) return false;
    if (parcelas.some(p => p.metodo === 'Dinheiro' && p.trocoPara && p.trocoPara < p.valor)) return false;
    return true;
  };

  const adicionarParcela = () => {
    if (parcelas.length >= 2) return;
    
    const novaParcela: Parcela = {
      id: Date.now().toString(),
      metodo: 'Dinheiro',
      valor: 0,
    };
    
    setParcelas([...parcelas, novaParcela]);
  };

  const removerParcela = (id: string) => {
    setParcelas(parcelas.filter(p => p.id !== id));
  };

  const atualizarParcela = (id: string, campo: keyof Parcela, valor: any) => {
    setParcelas(parcelas.map(p => 
      p.id === id ? { ...p, [campo]: valor } : p
    ));
  };

  const formatarMoeda = (valor: number) => {
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar()) {
      Alert.alert('Erro', 'Verifique se todos os campos estão preenchidos corretamente.');
      return;
    }

    const pagamentoResumo = {
      tipo: 'dividido',
      total,
      partes: parcelas.map(p => ({
        metodo: p.metodo,
        valor: p.valor,
        confirmado: p.confirmado,
        trocoPara: p.trocoPara,
        observacao: p.observacao,
      }))
    };

    // Salva o resumo do pagamento
    await SecureStore.setItemAsync(`pagamentoResumo_${pedidoId}`, JSON.stringify(pagamentoResumo));
    await SecureStore.setItemAsync(`pagamentoStatus_${pedidoId}`, 'confirmado');

    Alert.alert('Sucesso', 'Pagamento dividido confirmado!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const renderCondicionais = (parcela: Parcela) => {
    switch (parcela.metodo) {
      case 'Dinheiro':
        return (
          <View style={styles.condicionalContainer}>
            <Text style={styles.condicionalLabel}>Troco para:</Text>
            <TextInput
              style={styles.input}
              placeholder="R$ 0,00"
              keyboardType="numeric"
              value={parcela.trocoPara ? formatarMoeda(parcela.trocoPara) : ''}
              onChangeText={(text) => {
                const valor = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                atualizarParcela(parcela.id, 'trocoPara', valor);
              }}
            />
          </View>
        );
      
      case 'PIX':
        return (
          <View style={styles.condicionalContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => atualizarParcela(parcela.id, 'confirmado', !parcela.confirmado)}
            >
              <Ionicons 
                name={parcela.confirmado ? "checkbox" : "square-outline"} 
                size={20} 
                color={parcela.confirmado ? "#4caf50" : "#666"} 
              />
              <Text style={styles.checkboxLabel}>PIX confirmado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoCopiar}>
              <Text style={styles.textoBotaoCopiar}>Copiar chave</Text>
            </TouchableOpacity>
          </View>
        );
      
      case 'Débito':
      case 'Crédito':
        return (
          <View style={styles.condicionalContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => atualizarParcela(parcela.id, 'confirmado', !parcela.confirmado)}
            >
              <Ionicons 
                name={parcela.confirmado ? "checkbox" : "square-outline"} 
                size={20} 
                color={parcela.confirmado ? "#4caf50" : "#666"} 
              />
              <Text style={styles.checkboxLabel}>Aprovado no POS</Text>
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  const renderParcela = (parcela: Parcela, index: number) => (
    <View key={parcela.id} style={styles.parcelaContainer}>
      <View style={styles.parcelaHeader}>
        <Text style={styles.parcelaTitulo}>Parcela {index + 1}</Text>
        {parcelas.length > 1 && (
          <TouchableOpacity
            style={styles.botaoRemover}
            onPress={() => removerParcela(parcela.id)}
          >
            <Text style={styles.textoBotaoRemover}>Remover</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.campoContainer}>
        <Text style={styles.campoLabel}>Método:</Text>
        <View style={styles.pickerContainer}>
          {(['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Outros'] as MetodoPagamento[]).map((metodo) => (
            <TouchableOpacity
              key={metodo}
              style={[
                styles.opcaoMetodo,
                parcela.metodo === metodo && styles.opcaoMetodoSelecionada
              ]}
              onPress={() => atualizarParcela(parcela.id, 'metodo', metodo)}
            >
              <Text style={[
                styles.textoOpcaoMetodo,
                parcela.metodo === metodo && styles.textoOpcaoMetodoSelecionada
              ]}>
                {metodo}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.campoContainer}>
        <Text style={styles.campoLabel}>Valor:</Text>
        <TextInput
          style={styles.input}
          placeholder="R$ 0,00"
          keyboardType="numeric"
          value={parcela.valor > 0 ? formatarMoeda(parcela.valor) : ''}
          onChangeText={(text) => {
            const valor = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
            atualizarParcela(parcela.id, 'valor', valor);
          }}
        />
      </View>

      {renderCondicionais(parcela)}

      <View style={styles.campoContainer}>
        <Text style={styles.campoLabel}>Observação (opcional):</Text>
        <TextInput
          style={[styles.input, styles.inputObservacao]}
          placeholder="Observações sobre o pagamento..."
          value={parcela.observacao}
          onChangeText={(text) => atualizarParcela(parcela.id, 'observacao', text)}
          maxLength={120}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.titulo}>Dividir pagamento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resumo */}
        <View style={styles.resumoContainer}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoLabel}>Total:</Text>
            <Text style={styles.resumoValor}>{formatarMoeda(total)}</Text>
          </View>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoLabel}>Restante:</Text>
            <Text style={[
              styles.resumoValor,
              restante > 0.01 ? styles.resumoValorNegativo : styles.resumoValorPositivo
            ]}>
              {formatarMoeda(restante)}
            </Text>
          </View>
        </View>

        <Text style={styles.explicacao}>
          Distribua o total em até 2 formas de pagamento.
        </Text>

        {/* Parcelas */}
        {parcelas.map((parcela, index) => renderParcela(parcela, index))}

        {/* Adicionar parcela */}
        {parcelas.length < 2 && (
          <TouchableOpacity style={styles.botaoAdicionar} onPress={adicionarParcela}>
            <Ionicons name="add-circle-outline" size={24} color="#2C79FF" />
            <Text style={styles.textoBotaoAdicionar}>Adicionar 2ª forma</Text>
          </TouchableOpacity>
        )}

        {/* Regras */}
        <View style={styles.regrasContainer}>
          <Text style={styles.regrasTitulo}>Regras:</Text>
          <Text style={styles.regraItem}>• Soma deve ser exatamente igual ao Total</Text>
          <Text style={styles.regraItem}>• Cada valor ≥ R$ 0,50</Text>
          <Text style={styles.regraItem}>• PIX/Cartão: marcar confirmação</Text>
          <Text style={styles.regraItem}>• Troco só na parcela em Dinheiro</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}> 
        {Math.abs(restante) < 0.01 && (
          <TouchableOpacity
            style={[
              styles.botaoConfirmar,
              podeConfirmar() ? styles.botaoConfirmarAtivo : styles.botaoConfirmarInativo
            ]}
            onPress={handleConfirmar}
            disabled={!podeConfirmar()}
          >
            <Text style={styles.textoBotaoConfirmar}>Confirmar pagamento</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  botaoVoltar: {
    padding: 8,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  resumoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  resumoItem: {
    alignItems: 'center',
  },
  resumoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resumoValor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  resumoValorNegativo: {
    color: '#d32f2f',
  },
  resumoValorPositivo: {
    color: '#4caf50',
  },
  explicacao: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  parcelaContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  parcelaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  parcelaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  botaoRemover: {
    padding: 8,
  },
  textoBotaoRemover: {
    color: '#d32f2f',
    fontSize: 14,
  },
  campoContainer: {
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  opcaoMetodo: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  opcaoMetodoSelecionada: {
    borderColor: '#2C79FF',
    backgroundColor: '#2C79FF',
  },
  textoOpcaoMetodo: {
    fontSize: 14,
    color: '#666',
  },
  textoOpcaoMetodoSelecionada: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputObservacao: {
    height: 80,
    textAlignVertical: 'top',
  },
  condicionalContainer: {
    marginTop: 8,
  },
  condicionalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  botaoCopiar: {
    backgroundColor: '#2C79FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  textoBotaoCopiar: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  botaoAdicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C79FF',
    borderStyle: 'dashed',
  },
  textoBotaoAdicionar: {
    color: '#2C79FF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  regrasContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  regrasTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  regraItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  botaoConfirmar: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoConfirmarAtivo: {
    backgroundColor: '#4caf50',
  },
  botaoConfirmarInativo: {
    backgroundColor: '#ccc',
  },
  textoBotaoConfirmar: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
