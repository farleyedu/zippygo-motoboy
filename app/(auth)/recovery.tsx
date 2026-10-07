import React from 'react';
import { KeyRound, Send } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Button, Feedback, Header } from '../../src/ui/Kit';
import { AuthIntro, AuthLink, AuthScreen } from '../../src/ui/AuthKit';

export default function RecoveryScreen() {
  const router = useRouter();
  const voltar = () => { if (router.canGoBack()) router.back(); else router.replace('/(auth)/login'); };
  return <AuthScreen>
    <Header title="Recuperar acesso" onBack={voltar} />
    <AuthIntro icon={KeyRound} title={'A gente te ajuda\na voltar.'} description="A recuperação de senha ainda não está disponível no app." />
    <Feedback title="Recuperação indisponível" message="Nenhuma instrução pode ser enviada por aqui neste momento. Se precisar de ajuda para acessar sua conta, procure o responsável pelo estabelecimento." />
    <Button icon={Send} disabled onPress={() => {}}>Enviar instruções</Button>
    <AuthLink onPress={voltar}>Voltar para entrar</AuthLink>
  </AuthScreen>;
}
