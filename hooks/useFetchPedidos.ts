import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchPedidosMotoboy as fetchPedidos, fetchPedidoById } from '../services/apiService';
import { Pedido, PedidosResponse, BuscarPedidosParams, ApiState } from '../types/pedido';

// Hook para buscar lista de pedidos
export const useFetchPedidos = (params?: BuscarPedidosParams) => {
  const [state, setState] = useState<ApiState<PedidosResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  // Memoiza os parâmetros para evitar recriação desnecessária
  const memoizedParams = useMemo(() => params, [JSON.stringify(params)]);

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetchPedidos(memoizedParams);
      
      console.log('📡 Raw API data for orders:', response);
      
      if (response.pedidos && response.pedidos.length > 0) {
        const primeiroPedido = response.pedidos[0];
        console.log('🔍 PRIMEIRO PEDIDO COMPLETO:', primeiroPedido);
        console.log('🔍 CAMPOS DISPONÍVEIS:', Object.keys(primeiroPedido));
        
        // Verifica especificamente os campos que esperamos
        console.log('🔍 nomeCliente:', primeiroPedido.nomeCliente);
        console.log('🔍 enderecoEntrega:', primeiroPedido.enderecoEntrega);
        console.log('🔍 telefoneCliente:', primeiroPedido.telefoneCliente);
        console.log('🔍 statusPedido:', primeiroPedido.statusPedido);
        console.log('🔍 dataPedido:', primeiroPedido.dataPedido);
        console.log('🔍 motoboyResponsavel:', primeiroPedido.motoboyResponsavel);
        
        // Verifica se há campos com valores não-null
        const camposComValor = Object.entries(primeiroPedido)
          .filter(([key, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => `${key}: ${value}`);
        console.log('🔍 CAMPOS COM VALOR:', camposComValor);
      }
      
      setState({
        data: response,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState({
        data: { pedidos: [], total: 0, page: 1, limit: 10, hasMore: false },
        loading: false,
        error: `Erro ao carregar pedidos: ${error.message}`,
      });
    }
  }, [memoizedParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    pedidos: state.data?.pedidos || [],
    total: state.data?.total || 0,
    loading: state.loading,
    error: state.error,
    refetch: fetchData,
    hasMore: state.data?.hasMore || false,
  };
};

// Hook para buscar pedido por ID
export const useFetchPedidoById = (id: number | null) => {
  const [state, setState] = useState<ApiState<Pedido>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!id) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetchPedidoById(id);
      
      setState({
        data: response,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState({
        data: null,
        loading: false,
        error: error.message,
      });
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    pedido: state.data,
    loading: state.loading,
    error: state.error,
    refetch: fetchData,
  };
};







export default useFetchPedidos;
