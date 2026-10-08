import { useLocalSearchParams } from 'expo-router';
import CommunicationScreen from '../src/chat/CommunicationScreen';
import ClientConversation from '../src/chat/ClientConversation';

export default function Conversations() {
  const params = useLocalSearchParams<{ channel?: string }>();
  return params.channel === 'client' ? <ClientConversation /> : <CommunicationScreen />;
}
