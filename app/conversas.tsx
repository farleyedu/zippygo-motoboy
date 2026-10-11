import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import CommunicationScreen from '../src/chat/CommunicationScreen';
import ClientConversation from '../src/chat/ClientConversation';
import { Feedback, Screen } from '../src/ui/Kit';

export default function Conversations() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => { setHydrated(true); }, []);
  // O HTML estático não conhece a query. Renderizar o canal só após hidratar
  // evita reconstruir a tela ao abrir um link direto de conversa no navegador.
  if (!hydrated) return <Screen><Feedback title="Abrindo as conversas" loading /></Screen>;
  return params.channel === 'client' ? <ClientConversation /> : <CommunicationScreen />;
}
