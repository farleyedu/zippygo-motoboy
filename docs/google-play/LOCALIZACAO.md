# Localização em segundo plano — Google Play

Data: 13/10/2026. Nome comercial da listagem: **ZippyBoy**.

## Aviso e consentimento

O Android apresenta o diálogo **Localização durante seu turno** antes de solicitar localização ou iniciar o acompanhamento, inclusive quando as permissões do sistema já estavam concedidas. Texto:

> O ZippyBoy coleta sua localização durante o turno online para que o estabelecimento acompanhe sua posição no mapa e seu deslocamento nas entregas, mesmo quando o app está em segundo plano ou a tela está apagada. A coleta termina ao encerrar o turno.

**Concordar e continuar** persiste a versão 1, o usuário e a data do consentimento no SecureStore. **Agora não** e o botão Voltar do Android fecham o diálogo sem conceder consentimento ou solicitar permissões. Falha de armazenamento mantém o acompanhamento bloqueado. A reabertura com consentimento válido não repete o aviso. Outro usuário ou versão diferente exige nova aceitação.

O acompanhamento cobre o turno online, durante a espera por pedidos, a rota e o retorno à loja. Encerrar o turno confirmado pela API para o serviço. Uma sessão anterior com pedidos é preservada enquanto o acompanhamento aguarda consentimento; cancelar o diálogo não descarta pedidos nem encerra silenciosamente essa sessão. A tarefa headless interrompe um serviço antigo sem consentimento válido. Coleta pontual, envio e reenvio de fila também conferem o consentimento.

Web, iOS e Expo Go preservam seus fluxos anteriores. Expo Go não comprova funcionamento em segundo plano no Android; a validação precisa do build instalado.

## Textos para o formulário

**Finalidade do app** — abaixo de 500 caracteres:

> O ZippyBoy é um aplicativo de trabalho para motoboys de restaurantes e outros estabelecimentos. Permite receber e aceitar entregas, consultar pedidos e rotas, navegar até os destinos e registrar a conclusão das entregas. O estabelecimento acompanha a posição do motoboy durante o turno online para coordenar a operação.

**Acesso ao local** — uma única funcionalidade, abaixo de 500 caracteres:

> Acompanhamento da localização do motoboy durante o turno online. O app envia sua posição ao estabelecimento, inclusive enquanto ele usa Maps/Waze ou mantém a tela bloqueada. A localização em segundo plano mantém esse acompanhamento quando o app sai da tela, evitando interromper as atualizações durante as entregas. O rastreamento termina ao encerrar o turno.

## Vídeo da declaração

Gravar o build Android que contém esta alteração. Usar uma conta/loja de teste e publicar o vídeo com acesso ao revisor, por exemplo no YouTube como não listado. A duração recomendada pelo Google é de até 30 segundos:

1. Abrir a preparação do turno e o diálogo completo, com o texto legível e os dois botões.
2. Tocar **Concordar e continuar** e mostrar a concessão da localização pelo Android, inclusive segundo plano. Em uma instalação já autorizada, os pedidos do sistema não reaparecem; preparar a conta de teste e as permissões antes da gravação.
3. Ficar online/iniciar a rota. Mostrar no painel da loja a localização do mesmo motoboy.
4. Abrir Maps/Waze ou apagar a tela. Mostrar uma atualização real da posição ou do horário da amostra no painel enquanto o app está em segundo plano.

A gravação deve comprovar o comportamento real do Android. Telas Web, GPS mockado e capturas promocionais não constituem essa evidência. O vídeo da declaração é exigido independentemente do vídeo promocional opcional da página da loja. Fonte: [requisitos oficiais do Google Play](https://support.google.com/googleplay/android-developer/answer/9799150?hl=pt-BR).

## Validação

Testes de consentimento e regressões de localização/sessão:

```powershell
node --test --test-reporter=spec docs/google-play/location-consent-tests.cjs docs/validacao-etapa2/lote3/sync-tests.cjs docs/validacao-modo-rota/background-location-tests.cjs docs/validacao-web-ios/location-tests.cjs
node docs/validacao-etapa5/push-native-tests.cjs
node docs/validacao-etapa5/browser-native-domain.cjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

As dependências nativas são substituídas por fixtures nos testes de domínio. A validação funcional da tela usa React Test Renderer com os serviços reais de consentimento e a máquina de sessão, cobrindo cancelamento, continuação do aviso para a permissão, reabertura sem novo aviso e usuários com permissões já concedidas. O próprio diálogo é verificado para conteúdo e fechamento pelo Voltar do Android.

Resultados: tipagem TypeScript aprovada; oito casos novos de consentimento e quatro de tela/diálogo aprovados; 163 execuções aprovadas na seleção de sessão/GPS antes de acrescentar os quatro casos de tela/diálogo; 27 verificações aprovadas de notificações/Web; 27 testes de navegação aprovados, incluindo bloqueio do SDK sem consentimento. As execuções da seleção de sessão incluem casos compartilhados carregados por mais de uma suíte; os números não representam casos distintos.

Os testes antigos de navegação foram atualizados para carregar dependências locais, respeitar o limite explícito de dez destinos no app e quatro no navegador e impedir o salto de uma entrega sem endereço. O comportamento de montagem de links não foi alterado nesta tarefa.

**Conferência nativa (14/10/2026, Xiaomi Android 16, build debug isolado `com.zippy.zippyboy.consenttest`, API de demonstração local via ADB):**

- **Aprovado no aparelho:** primeiro acesso sem permissões (Ficar online abre a preparação, sem pedido do sistema); diálogo com título, texto integral e os dois botões; **Agora não** permanece na preparação, sem permissão, sem serviço e sem amostras; **Concordar e continuar** abre o pedido nativo de localização e depois o de segundo plano; concedidas, o turno fica online; reabrir o app com consentimento válido retoma o turno sem repetir o diálogo; **Encerrar meu turno** deixa a API inativa e a tarefa de localização deixa de executar; negar a permissão do Android leva à tela de permissão negada, sem turno e sem amostras.
- **Não comprovado — bloqueia o vídeo:** envio contínuo com o app em segundo plano. Com o app fora da tela (tela acesa ou bloqueada), a tarefa de localização continua sendo disparada a cada 30 s e passa pela verificação de consentimento, mas após o primeiro ou segundo envio a chamada à API deixa de concluir e as amostras só chegam quando o app volta ao primeiro plano (a fila local preserva as posições). Não foi isolado se a causa é o túnel USB (`adb reverse`) usado nesta conferência, a economia de bateria do MIUI ou o código; repetir com o build instalado e uma API acessível pela rede antes de gravar o vídeo.
- **Não conferido no aparelho (cobertos só pelos testes de domínio):** permissões já concedidas com consentimento novo e consentimento de outra versão/usuário.

O emulador API 36 e o build x86_64 falharam por espaço em disco/dependências C++; o cache `android/app/.cxx` foi apagado com autorização para liberar espaço. Capturas e vídeo para envio ao Google permanecem pendentes.

O roteiro acima deve ser executado no build instalado antes da submissão. A aprovação final da declaração é uma etapa externa do Google Play.

## Revisão dos arquivos em Changes

O painel administrativo estava sem alterações. No backend, os arquivos de importação/projeção/comandos, DTOs, migrações e testes iFood têm referências na implementação e foram preservados. O `if07-unit.trx` foi removido após comparar os nomes dos 17 testes com os 196 testes aprovados do `if07-regression.trx`: todos já constavam no relatório final. A referência em `IF-07.md` foi atualizada. O `if08-projection.trx` foi preservado porque contém um caso que não está no relatório de regressão.

No app, as artes/ZIP são entregáveis da listagem e os scripts permitem reproduzir capturas e demonstração. Foram preservados. As alterações de permissões, consentimento e mapas e suas fixtures de teste são necessárias para esta correção.

A exclusão adicional dos caches C++ x86_64 da tentativa de validação foi rejeitada pela revisão automática da ferramenta, com retorno `blocked by policy` e sem justificativa detalhada. Esses caches permanecem; não foi feita limpeza geral de `node_modules` ou de caches externos ao workspace.
