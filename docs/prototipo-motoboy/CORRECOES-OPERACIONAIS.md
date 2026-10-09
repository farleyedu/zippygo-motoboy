# Correções operacionais — 09/10/2026

## Escopo autorizado

As correções foram desenvolvidas no **zm57**, branch `upgrade/expo-sdk-57`. Em 09/10/2026, Farley autorizou trazer todas as alterações para **`C:/Users/farle/TI/Zippy/zippygo-motoboy` / `master`** e fazer o commit. Este passa a ser o checkout de trabalho vigente. Preservar os ajustes anteriores, a atualização Expo 57 e os documentos do plano. Backend e painel continuam em seus próprios repositórios; esta integração não faz commit/push neles.

Referência visual: `prototype.js`, CSS efetivo de `styles.css`, fotos reais do catálogo, componentes e tokens já existentes. Novas telas devem manter a mesma composição, tipografia, luz, profundidade e paleta. Comparar HTML e app na mesma largura/tema; evidência Web não valida funções nativas.

## Lotes e estado

- [ ] Oferta: push remoto, acesso à oferta, aceite/recusa por pedido e expiração sem duplicação.
- [ ] Conferência: identificação grande, produtos/fotos/adicionais/quantidades; confirmação final dos extras na coleta e na entrega; persistência e validação no servidor.
- [ ] Finalização: foto real com conversão/compressão, motivo visível de bloqueio do arraste, gesto funcional e recibo idempotente.
- [ ] Mapa: pins de todas as paradas, percurso por ruas inclusive com um pedido, seleção sem desmontar mapa, painel compacto, toque no mapa para recolher/mostrar controles.
- [ ] Navegação: SDK nativo, voz, manobras, recálculo, chegada e continuidade apenas após conferência/conclusão operacional. Depende de build próprio e configuração do serviço de navegação.
- [ ] Chat mobile: menu inferior, cabeçalho único, atalhos junto ao compositor, áudio interoperável, player com avatar/progresso/velocidade, pressão longa com vibração e ações/reação por emoji.
- [ ] Chat admin: anexos/microfone legíveis, prévia, gravação/revisão e player consistente; integração com mobile.
- [ ] Histórico de rotas: identificação própria da rota, percurso preservado antes da limpeza do GPS, pedidos/conferências/recibos e dinheiro da loja separado dos ganhos.
- [ ] Validação: tipos/build/testes de domínio e HTTP; comparação visual; jornada nativa com push, câmera, áudio, mapa e gesto. Não declarar concluído o que só passou em mock/navegador.

## Continuidade

Início: nenhuma alteração funcional desta rodada havia sido feita antes da confirmação do checkout `zm57`. Backend em `master`, admin em `main`. Há alterações prévias no zm57 que devem ser preservadas. As dúvidas de política de aceite e aparelho ainda não foram respondidas; conferir todos os itens e reconfirmar extras é o fluxo solicitado.

Atualizar este arquivo com arquivos alterados, validações reais e impedimentos antes de encerrar ou transferir a sessão.

### Implementação em andamento (09/10/2026)

O mobile foi confirmado no **zm57 / upgrade/expo-sdk-57**. As alterações anteriores do upgrade continuam presentes; não executar reset, limpeza geral ou commit de todos os arquivos. Nenhum commit/push desta rodada foi solicitado.

Código já escrito, ainda sujeito à revisão nativa:

- Conferência compartilhada de produtos/adicionais/quantidades/fotos, persistida por conta/loja/fase. `retirada.tsx`, `conferirExtras.tsx`, `pedido/[id].tsx`, `OrderChecklistCard`, hooks de checklist. Extras têm segunda confirmação; o backend valida a versão do conteúdo e salva os registros na transação de coleta/conclusão.
- Finalização mostra o número do pedido e a conferência da entrega, comprime/converte a foto para JPEG real e informa bloqueios do arraste. Preserva pagamento apenas na conclusão e a idempotência existente.
- Oferta permite aceitar parte dos pedidos e recusar os demais com revisão explícita. Backend valida oferta/versão/IDs e decide atomicamente. A configuração existente de aceite obrigatório da loja foi preservada: lojas em aceite automático ainda não geram uma oferta pendente.
- Push de oferta tem outbox transacional, sessão/destinatário, prazo, tentativas limitadas, tickets e recibos Expo; mobile tem canais Android e deduplicação do aviso remoto/local. Credenciais FCM/APNs e recebimento em aparelho ainda precisam ser comprovados.
- Chat mantém menu inferior, um cabeçalho, atalhos junto ao campo, player com avatar/progresso/velocidade e ações por pressão longa. Reações Unicode usam a base emoji-mart. Encaminhamento e revisão completa do chat admin ainda estão pendentes.
- Backend converte WebM/OGG/WAV para M4A/AAC com FFmpeg (incluído no Dockerfile); download permanece autenticado. Conversão real de áudio e teste em iOS/Android ainda pendentes.
- Admin tem botões de anexo/microfone com contraste, prévia antes de envio e gravação/revisão. Player e reações ainda precisam ser finalizados.
- Mapa reformulado com painel compacto, seleção de pins, toque para ocultar/mostrar controles e destino de coleta na loja. SDK Google Navigation 0.16.3 integrado em código; Expo Go mantém mapa legado e informa a necessidade de build próprio para navegação. Não afirmar navegação comprovada antes de build/configuração/teste nativo.

Novas migrations no backend: `20261009_01_delivery_order_checklists.sql`, `20261009_02_chat_emoji_reactions.sql`, `20261009_03_offer_push.sql`. Não foram aplicadas em produção nesta rodada.

Verificações realizadas: backend compilou sem erros (33 avisos anteriores); 20 testes unitários selecionados passaram; typecheck admin passou antes das últimas mudanças. Último typecheck mobile identificou dois problemas: coordenadas string no fallback externo (corrigido) e rota de histórico ainda inexistente (pendente).

Build Android em andamento: SDK nativo compilou, mas assemble detectou dependência Maps duplicada (autolink RN Maps desativado somente Android) e necessidade de `desugar_jdk_libs_nio`. Corrigido no Gradle e plugin CNG; novo build iniciado. Expo 57 exige iOS mínimo 16.4 (ajustado). Ainda não existe APK validado desta rodada. `adb devices` estava vazio; não houve comparação de capturas nativas.

Próximos itens obrigatórios: histórico real com identidade própria e GPS preservado; encaminhamento autenticado/idempotente; player admin; teste parcial de aceite e migrations/HTTP; fechamento de navegador ao sair da sessão; validação de toque de push e cold start; testes de áudio/câmera/slide/mapa e comparação visual com HTML.

Cuidados: não substituir fotos do catálogo por ilustrações, não inferir bebidas pela foto, não fabricar caminho do histórico juntando destinos em linha reta, não confundir dinheiro da loja com ganho do motoboy, não navegar para próximo pedido antes do ACK operacional.

### Revisão solicitada: excesso de imagens de pins

Farley apontou que uma imagem por número era desnecessária. Correção aplicada no **zm57**:

- Os **201 PNGs gerados** em `assets/images/route-pins` e suas **201 cópias Android** saíram do checkout. A revisão automática bloqueou a exclusão; a alternativa reversível moveu somente esses arquivos não versionados para `C:/Users/farle/.codex/tmp/zippy-pin-backup-20261009`. Assets antigos e imagens do protótipo foram preservados.
- `SdkMapa.tsx` usa `zippy-pin:current:N`, `zippy-pin:future:N` e `zippy-pin:store`. O desenho nativo inclui o número, fundo, borda e profundidade; não há um limite artificial de 100 baseado em arquivos existentes. Cache de no máximo 32 desenhos em memória.
- Removidos `components/numberedPins.ts` e os passos de cópia de PNGs Android/iOS do plugin `withNativeNavigation.js`.
- O SDK 0.16.3 não aceita filhos React nem texto de rótulo diretamente em MarkerOptions. Um patch limitado ao desenho dos marcadores Android/iOS adiciona essa capacidade, sem gerar PNGs nem alterar APIs de navegação. Está em `patches/@googlemaps+react-native-navigation-sdk+0.16.3.patch`, reaplicado por `patch-package --error-on-fail` no postinstall. Ao atualizar o SDK, revisar o patch; uma incompatibilidade deve falhar explicitamente.
- TypeScript passou depois da revisão. **assembleDebug passou (BUILD SUCCESSFUL em 2m35s, 572 tasks)** com o desenho nativo dos pins. `npm run postinstall` reaplicou o patch sem erro; APK inspecionado sem os PNGs numerados. iOS e visual nativo ainda não verificados.

### Atualização de implementação e verificações

- Histórico real escrito: migrations `20261009_04_route_history.sql`, serviço/controlador próprios autorizados pelo token de conta, `historicoRotas.tsx` e `rotaHistorico.tsx`. Viagem identificada na retirada, pontos GPS reais arquivados antes da limpeza, intervalos sem sinal separados, valores de ganho e dinheiro da loja separados. Não inventa trajeto antigo nem histórico antes da migration. Retenção do caminho: 90 dias.
- Encaminhamento escrito: `ChatForwardSheet.tsx`, seleção de destino autorizado e reupload autenticado do arquivo, fila/idempotência existente. Flag `forwarded` na migration `20261009_05_chat_forwarded.sql`; hash antigo preservado para mensagens anteriores sem encaminhamento.
- Player admin `ChatAudioPlayer.tsx` escrito com reproduzir/pausar, progresso, seek, tempo e velocidade. Envio de mídia limpa a prévia somente depois de entrar na fila durável. Ainda validar troca de conversa durante seleção/gravação e integração de áudio entre plataformas.
- Build Android anterior desta rodada passou (**572 tasks, BUILD SUCCESSFUL**), antes da revisão dos pins. Não confundir compilação com navegação/GPS em aparelho; `adb devices` estava vazio.
- TypeScript mobile passou na revisão dos pins; tipo do destinatário vem de `queue.motoboyId`, não de um campo inexistente da sessão.
- PostgreSQL local de testes em `127.0.0.1:56437`, schemas isolados e sem produção. Primeiro lote: **20 passaram e 1 falhou** (trigger de histórico ao receber timestamp nulo no fixture). Corrigido com fallback ao tempo da transação; **rerun: 23 passaram, 0 falhas, 0 ignorados**. Inclui conferência/rollback financeiro, seleção parcial, recusa de oferta pendente, histórico GPS com isolamento/limpeza, chat e emojis. Worker push testado com PostgreSQL real e **HTTP falso**, cobrindo registro tardio, deduplicação, preferências, recuperação de lease esgotado e sessão revogada. Isso não comprova recebimento em aparelho.
- Política preservada: a loja ainda pode configurar aceite automático; oferta pendente pode ser recusada, enquanto a regra de devolução de pedido já aceito permanece separada. Resposta do usuário sobre obrigatoriedade de aceite e aparelho de testes ainda ausente.

Não houve commit, push, deploy ou migrations em produção desta rodada. Pendente: finalizar testes funcionais/HTTP, comparação visual com HTML e jornada nativa real (push, áudio, câmera, gesto e navegação), além de habilitar/validar serviços Google Navigation e credenciais FCM/APNs no ambiente do usuário.

### Fechamento da revisão dos pins

- **Zero PNGs da coleção no checkout e no APK**; desenho dinâmico confirmado dentro do DEX Android. Próximo destino/seleção e demais paradas têm dois estilos reutilizados, com número desenhado em tempo de execução; o estabelecimento também é desenhado, sem arquivo de imagem. Assets antigos do mapa legado continuam preservados.
- Atualização de seleção usa os IDs estáveis dos marcadores e atualiza ícones existentes, sem apagar/recriar todos a cada toque. Operações de marcadores e cálculos de rota serializados para evitar respostas atrasadas sobrepondo o estado atual. Não depender de seleção para recalcular o percurso.
- Revisão adjacente: histórico no mapa legado enquadra GPS gravado e não centraliza na posição atual; controles nativos respeitam mapa limpo; toque em push privado busca o motoboy da fila restaurada e valida participantes; admin rejeita envio de arquivo se a conversa mudar durante FileReader.
- Ajustado contrato camelCase dos recibos no histórico e removida indicação de pagamento recebido quando não há recebimento registrado; consulta de checklist preserva a imagem real do catálogo no snapshot.
- **Verificações finais:** TypeScript mobile e admin sem erros; backend build com 0 erros/33 avisos anteriores; **93 testes de domínio mobile passaram**, incluindo checklist manual, bebida reconferida, versão alterada, sincronização e fila de chat. Os **23 testes backend** mencionados acima passaram com PostgreSQL real local e fake HTTP de push. Não houve mensagem, pagamento ou pedido real de QA.
- PostgreSQL iniciado para esta rodada foi **encerrado** após os testes. Os schemas de QA são isolados e removidos pelos fixtures. Logs locais: `corrections-tests.log`, `corrections-build.log` no backend; `corrections-typecheck.log`, `corrections-domain-tests.log` e `android/build-native-navigation.log` no zm57. Não comitar esses logs como código.
- **Pendências continuam abertas:** conversão FFmpeg com mídia real e reprodução Android/iOS; câmeras/foto/gesto/push/navegação em aparelho; fidelidade visual comparada ao HTML; integração HTTP ponta a ponta e publicação coordenada das migrations/app. Checklist é exigido para pedidos detalhados no novo backend, portanto não publicar o backend sozinho sem tratar o rollout dos clientes antigos.

### Integração no checkout principal — 09/10/2026

Farley autorizou trazer todas as alterações do `zm57` para `zippygo-motoboy` e comitar na `master`. Os dois checkouts partiam de `4ca4067`. Transferidos os 120 arquivos modificados/novos da origem, incluindo a remoção do XML de rede substituído pelo plugin Expo. Cinco arquivos com ajustes locais foram mesclados, preservando correções de áudio e offsets SVG. Os nove arquivos inicialmente modificados no destino foram preservados ou integrados. Plano, protótipo HTML e fotos mantidos. Logs e dependências/builds regeneráveis não fazem parte do commit.

- Backup das alterações e manifesto de transferência: `C:/Users/farle/.codex/tmp/zippy-master-integration-20261009`. Conteúdo transferido conferido; o `zm57` permanece como referência e não foi limpo/resetado.
- `npm ci --no-audit --no-fund` passou; **952 pacotes**, Expo **57.0.27**, React Native **0.86.3**, React **19.2.3**. `postinstall` aplicou o patch do SDK Google Navigation **0.16.3**. O novo valor de `EXPO_PUBLIC_USE_RN_FETCH` foi mantido.
- Tipos locais `.expo/types/router.d.ts` regenerados por `setupTypedRoutes` da CLI instalada do Expo, para incluir conferência de extras e histórico. O cache anterior não conhecia as novas telas. A pasta `.expo` continua ignorada.
- Ajustados dois roteiros antigos: testes de câmera/centrar agora apontam explicitamente para `LegacyMapa`, o fixture de detalhes fornece o hook de checklist e o teste de notificações verifica os **oito canais de chat e quatro de ofertas**, com IDs únicos, importância, som e vibração. As verificações anteriores foram preservadas.
- **Verificação final no zippygo-motoboy:** `npx tsc --noEmit` passou; `node --test --test-concurrency=2` com os oito roteiros de sessão/sincronização/conclusão/regressões/chat/push/browser/ganhos terminou com **127 testes, 127 passaram, 0 falhas/ignorados**.
- `:app:processDebugResources` passou no checkout principal: **BUILD SUCCESSFUL em 4m38s / 263 tarefas**. Isso valida a integração e os recursos Android; o APK completo já havia sido compilado no `zm57`, mas não foi reconstruído/reinstalado nesta transferência.
- `.gitattributes` preserva CRLF dos scripts Windows e reconhece os espaços de contexto obrigatórios dos patches unificados. `.gitignore` ignora somente os logs locais da rodada. `AGENTS.md` e os documentos de continuidade agora apontam para o checkout principal.
- Logs locais ignorados: `integration-install.log`, `integration-typecheck.log`, `integration-domain-tests.log`, `integration-regressions.log` e `android/build-integration-resources.log`.

O commit solicitado é local à `master` do mobile. Esta transferência não publicou o app, não aplicou migrations nem fez commit/push no backend/admin. Permanecem as pendências de aparelho/iOS, mídia real e publicação coordenada descritas acima.
