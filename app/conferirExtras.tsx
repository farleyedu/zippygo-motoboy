import { Redirect, useLocalSearchParams } from 'expo-router';

// Links antigos voltam à conferência principal; o resumo agora abre nela.
export default function ExtrasScreen() {
  const { stage, id } = useLocalSearchParams<{ stage?: string; id?: string }>();
  return <Redirect href={stage === 'delivery' ? { pathname: '/confirmacaoEntrega', params: { id: id || '' } } : '/retirada'} />;
}
