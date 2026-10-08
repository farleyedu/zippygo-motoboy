# Correcoes dos cinco achados da etapa 5

Data: 2026-10-08. Escopo aprovado: corrigir os cinco problemas encontrados na revisao, sem implementar etapas futuras. Nao houve commit, push, publicacao ou envio real de mensagens.

## Resultado implementado

1. Push: destinatario, estabelecimento e sessao ficam congelados na fila. Troca de dono do token descarta notificacoes pendentes; worker revalida autorizacao antes do envio e aplicativo ignora sessao diferente.
2. Cliente: fotos e audios recebidos usam download autenticado por pedido, com verificacao da fila e estabelecimento. Busca ocorre no historico do servidor, com cursor composto. Reacoes so sao persistidas depois de confirmacao do WhatsApp.
3. Rascunhos: texto e destinatarios das mencoes sao salvos juntos. Rascunhos antigos de texto continuam legiveis; mencoes removidas nao notificam.
4. Historico: atualizacao e confirmacao de envio preservam mensagens antigas ja carregadas. Mudanca de usuario, sessao ou conversa limpa o estado anterior.
5. Aviso de mencao: o identificador abre o contexto protegido da mensagem, inclusive fora da primeira pagina, com rolagem e destaque temporario. A citacao tambem localiza a mensagem original.

## Arquivos principais

- Aplicativo: `src/chat/CommunicationScreen.tsx`, `ClientConversation.tsx`, `ChatMedia.tsx`, `ChatNotices.tsx`, `draft.ts`, `media.ts`, `services/communicationApi.ts` e `app/_layout.tsx`.
- Backend: repositorios e servicos de comunicacao, `Service/ChatPushService.cs`, controllers de comunicacao, DTOs, `Automation/Services/WhatsAppSender.cs`, `ConversationManagementService.cs` e cliente HTTP em `Program.cs`.
- Banco: `Migrations/Delivery/20261008_06_comunicacao_correcoes.sql`, verificacao `20261008_07_verify_comunicacao_correcoes.sql` e rollback protegido em `Migrations/Delivery/rollback/`.
- Evidencias: testes de dominio, navegador e capturas nesta pasta; testes unitarios/integracao e resultados TRX em `motoboyBackEnd/docs/validacao-etapa5/`.

## Validacao

- Backend completo: 975 aprovados, zero falhas ou ignorados.
- Backend focado, repetido depois da verificacao SQL: 26 aprovados, zero falhas ou ignorados. Migration 06 aplicada duas vezes em cada fixture; verificacao 07 executada.
- Aplicativo: `npx tsc --noEmit` sem erros; 14 testes de dominio aprovados.
- Banco usado: PostgreSQL temporario local na porta 56439, schemas isolados e removidos pelos testes. Nenhuma migration aplicada ao banco real.
- Navegador: quatro fluxos aprovados, dez capturas em 320/390 pixels e temas claro/escuro, sem overflow horizontal nem erros JavaScript. Conferencia visual incluiu destaque da mensagem antiga, foto/reacao/busca e toolbar compacta do cliente. Resultados em `correcoes-browser-results.json`; API interceptada, sem mensagens reais. Capturas nao equivalem a homologacao Android.

## Pendencias reais e implantacao

- Aplicar migration 06 e executar verificacao 07 antes de habilitar as novas rotas/reacoes e push em ambiente real. Rollback bloqueia remocao se houver reacoes gravadas; nao foi executado em producao.
- Homologar gravacao/reproducao de audio, som, vibracao e notificacao de mencao em aparelho Android, com aplicativo recompilado. Esta validacao nao comprova entrega real Expo nem WhatsApp.
- Midia recebida depende do evento original `wa_evento` persistido e de credenciais validas do canal. Arquivos indisponiveis no provedor mostram erro; nao existe recuperacao artificial.
- Audio para cliente no navegador permanece desabilitado; envio nativo conserva o formato existente. Reacoes usam as quatro opcoes atuais.
- Push ja entregue ao Expo nao pode ser recolhido. Conteudo do aviso continua generico e o aplicativo filtra sessao divergente.
- Estes resultados encerram as cinco correcoes; nao certificam toda a etapa 5 nem planos futuros. O admin e suas alteracoes preexistentes foram preservados.

Preview local: http://localhost:8198 (servidor Expo; depende de login/API no uso normal).

## Continuacao: permissao e sons nativos

Correcoes adicionais aprovadas em 2026-10-08:

- `src/chat/push.ts`: cria canais antes de solicitar permissao/token; solicita uma vez na instalacao nova e respeita negativa. Chamadas simultaneas compartilham o mesmo pedido. Web nao solicita push nativo.
- `app/somVibracao.tsx`: comando explicito para permitir notificacoes; bloqueio definitivo abre configuracoes do sistema, sem insistir em prompts. Preferencias de som/vibracao continuam independentes da permissao.
- `assets/sounds/`, `app.config.ts`, `ChatNotices.tsx` e `android/app/src/main/res/raw/`: nomes Android validos `chat_message.wav` e `chat_mention.wav`. Recursos nativos copiados integralmente; gerador auxiliar atualizado.
- `motoboyBackEnd/Service/ChatPushService.cs`: mesmos nomes de som e canais `v2`, evitando reutilizar canais Android antigos com configuracao imutavel.
- Nove testes adicionais aprovados em `push-native-tests.cjs`; TypeScript sem erros e 20 testes de comunicacao do backend aprovados nesta continuacao. Testes simulam SDKs e verificam bytes WAV e contratos, nao comprovam som ou vibracao fisicos.

Implantar backend e aplicativo recompilado de forma coordenada antes de habilitar push. Aplicativos antigos nao conhecem os canais/sons v2. Nao houve build APK, pois SDK/ADB nao estao configurados nesta maquina; teste de aparelho e entrega real permanecem pendentes.
