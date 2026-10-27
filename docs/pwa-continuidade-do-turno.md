# PWA: continuidade do turno

## O que mudou no app
- **Modos**: `services/executionMode.ts` separa `native`, `web-installed` e `web-browser`. Não há segundo app; só o texto e as orientações mudam.
- **Turno sem GPS (Web)**: `start()` não exige permissão de localização quando `locationOptional` (Web). O estado `locationLimited` informa a limitação sem tratá-la como erro; a cada retomada/batimento as permissões são relidas e o GPS volta sozinho. No Android nativo a permissão continua obrigatória e o GPS segue em segundo plano.
- **Perda de GPS, aba oculta, rede ou suspensão** não encerram o turno nem a conta: erro de rede com GPS ausente vira `reconnecting`, nunca `permission-required` na Web. GPS indisponível aparece como "Localização · Indisponível", nunca como turno encerrado.
- **Textos de localização**: no PWA a localização só é enviada com o ZippyGo aberto, visível e permitido (`app/turno.tsx`, `HomeScreen`, `OperationalStatus`, `privacidade`, `permissoes`). Fora disso a loja vê a última posição confirmada com o horário dela (`useTrackingDiagnostics`: "Última localização há N min"); nenhuma tela a apresenta como posição atual.

## Contratos do backend usados (motoboyBackEnd, commit 99f1bd6)
Nenhuma mudança no backend nesta etapa.

### Encerramento — `DELETE /api/v2/motoboys/me/session?reason=...&confirmPendingWork=...`
- Sem pedidos: encerra e devolve a sessão.
- Com paradas `assigned`/`en_route` ou transferência `pending_approval`: `409 MOTOBOY_HAS_PENDING_WORK` (`details.canConfirm=true`).
- Com `confirmPendingWork=true`: encerra e a loja assume os pedidos como incidente.

No app (`services/mobileApi.ts` → `endOperationalSession`, `src/session/operationalSessionStore.ts` → `end`, `src/hooks/useEndShift.ts`):
- `confirmPendingWork=true` só é enviado depois que a pessoa toca no botão explícito ("Encerrar e passar pedidos à loja" / "Passar pedidos à loja e sair"), exibido quando a fila local tem pedidos ou quando o servidor já recusou com 409.
- O 409 deixa `pendingWorkEnd=true`, fase `online`, fila, sessão e dados locais intactos; o app **não** repete sozinho.
- Erro, timeout ou falta de rede mantêm o turno (`reconnecting`/`online`). Nada local é limpo antes da resposta de sucesso.
- Encerramentos simultâneos reaproveitam a mesma solicitação (`runAfterIdle` com o tipo `end`) e o hook ignora toques durante o envio.
- Conclusão não confirmada (`pending`/`sending`) bloqueia o encerramento antes de qualquer chamada (`assertRouteMutationAllowed`). A limpeza do turno não toca o rascunho de conclusão.
- Telas alinhadas: `app/turno.tsx`, `app/resumoTurno.tsx` e `src/ui/LogoutAction.tsx` (o logout encerra o turno com a mesma confirmação e só então sai da conta; se o turno não encerrar, a conta continua).

### Atividade humana — `POST /api/v2/motoboys/me/session/activity`
Resposta (`OperationalActivityResponse`): `recorded`, `serverTimeUtc`, `lastHumanActivityAtUtc`, `inactivityExpiresAtUtc`, `inactivityRemainingSeconds`. Não traz a sessão.
- `services/sessionActivity.ts`: só toque/tecla real (`isTrusted` na Web; captura de toque no nativo), no máximo uma vez a cada 2 min, com turno aberto, app visível e rede. Heartbeat, GPS e eventos automáticos não passam por aqui, então não renovam as 7 h.
- `store.applyActivity(ack, sessionId)` altera apenas os campos de inatividade da sessão do toque; identidade, versão, token e fila ficam como estão. Resposta de outro turno, de turno encerrado ou mais antiga que a atual é ignorada.
- `recorded=false`: o servidor ignorou o toque pelo limite de frequência, mas devolve o prazo vigente; esse prazo (confirmado) é aplicado.
- Sem resposta ou sem prazo legível: nada muda; falha de rede/5xx tenta de novo no próximo toque após 30 s; 401 é tratado pelo turno; 404/405/501 desliga o envio até reabrir.
- O heartbeat devolve a sessão com o prazo vigente; `keepLatestActivity` impede que uma resposta iniciada antes do toque recue o prazo já confirmado.
- `endReason = inactivity_7h` mostra o motivo e que os pedidos ficaram sob gestão do estabelecimento.

### Web Push — `GET .../offer/web-push/configuration` e `PUT .../offer/web-push`
O backend não tem consulta de inscrição; o app considera "registrado" apenas depois de um `PUT` com sucesso para a sessão atual (`services/webOfferPush.ts` → `webPushRegistration`).
- Estados mostrados em `OperationalStatus`: não autorizado (Desativadas/Bloqueadas), autorizado sem turno (Permitidas), autorizado sem registro ou com falha (Sem registro, botão "Registrar avisos"/"Tentar registrar de novo"), registrando, registrado (Registradas) e indisponível (navegador sem Web Push ou servidor sem chave).
- Inscrição de outra sessão ou estabelecimento não conta; encerrar o turno zera o estado. O registro automático (`ChatNotices`, a cada 60 s com o app em primeiro plano) refaz o `PUT` e troca a inscrição se a chave pública mudar.
- Nenhum texto promete recebimento com o app fechado; iPhone continua exigindo o PWA instalado na Tela de Início.
- Toque na notificação: `/?offerNotice=<id>` (e a mensagem do service worker) só abre `/oferta` depois que a fila do servidor confirmar o mesmo `offerId` e a validade.

## Validação
- `npx jest --watchAll=false`: 11 suítes, 113 testes passando (novos cenários em `operationalSessionStore.web.test.ts`, `services/__tests__/webMode.test.ts` e `webDraftStorage.test.ts`).
- `npx tsc --noEmit`: sem erros no código do app; restam apenas os erros de tipos globais do Jest nos arquivos de teste (o projeto não tem `@types/jest`), já existentes antes.
- Regressões do store/nativo: `docs/validacao-etapa2/lote3/session-tests.cjs`, `sync-tests.cjs` e `docs/google-play/location-consent-tests.cjs` — 30 casos aprovados (os processos não terminam sozinhos por um handle aberto já existente; rodar com `node <arquivo>` e interromper após o resumo).
- **Não validado (exige aparelho real)**: Android nativo em uso (GPS em segundo plano, encerramento com pedidos), Chrome Android, Safari no iPhone e PWA instalado (Web Push de fato recebido com o app fechado), e o encerramento com pedidos contra o backend real gerando o incidente para a loja. Também não houve comparação visual com o protótipo (`docs/prototipo-motoboy`) dos novos avisos e botões das telas Turno, Resumo e Sair.
