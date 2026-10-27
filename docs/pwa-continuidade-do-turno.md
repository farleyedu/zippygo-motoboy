# PWA: continuidade do turno

## O que mudou no app
- **Modos**: `services/executionMode.ts` separa `native`, `web-installed` e `web-browser`. Não há segundo app; só o texto e as orientações mudam.
- **Turno sem GPS (Web)**: `start()` não exige mais permissão de localização quando `locationOptional` (Web). O estado `locationLimited` informa a limitação sem tratá-la como erro; a cada retomada/batimento as permissões são relidas e o GPS volta sozinho. No Android nativo a permissão continua obrigatória.
- **Perda de GPS, aba oculta, rede ou suspensão** não encerram o turno nem a conta: erro de rede com GPS ausente vira `reconnecting`, nunca `permission-required` na Web.
- **Atividade humana**: `services/sessionActivity.ts` chama `POST /api/v2/motoboys/me/session/activity` só após toque/tecla real (`isTrusted` na Web; captura de toque no nativo), no máximo uma vez a cada 2 min, sem timer, com turno aberto, app visível e rede. 404/405/501 desliga o envio até reabrir o app.
- **Encerramento**: o cliente não bloqueia mais por pedidos; o servidor decide. Nada local é limpo antes da resposta dele (`ending` → `end` → `clear`). A confirmação explica a consequência.
- **Inatividade**: `endReason` com `inactiv`/`idle` mostra o motivo e que os pedidos ficaram sob gestão do estabelecimento (`sessaoEncerrada`).
- **Notificações**: painel `OperationalStatus` na Home (turno, localização, notificações, conexão) com botão funcional; orientação distinta para iPhone no Safari (instalar na Tela de Início), PWA instalado, e navegador sem Web Push (sem prometer alerta com a página fechada).
- **Toque na notificação**: `/?offerNotice=<id>` (e a mensagem do service worker) só abre `/oferta` depois que a fila do servidor confirmar o mesmo `offerId` e a validade.
- **Rascunho de conclusão (Web)**: `localStorage` (reserva `sessionStorage`), chave por usuário; rascunho não enviado de outro turno é descartado; conclusões enviadas nunca são descartadas e são reconsultadas ao voltar a rede (mesmo `operationId`).

## Suposições sobre o backend (confirmar quando o contrato fechar)
O repositório `motoboyBackEnd` (master) **ainda não tem** `POST .../session/activity` nem o encerramento por 7 h. O app assume, de forma tolerante:
- `POST /api/v2/motoboys/me/session/activity` responde `{ session }` (ou a própria sessão); sem corpo/404 é ignorado.
- `session.inactivityExpiresAtUtc` (opcional) alimenta o prazo restante; sem ele o app não calcula prazo.
- `session.endReason` / `error.code` contendo `inactiv` ou `idle` identifica o encerramento por inatividade.
- `DELETE /session` com pedidos em andamento: hoje o servidor responde `409 MOTOBOY_HAS_PENDING_WORK`; o app mostra a mensagem dele e mantém tudo. Quando o backend aceitar o encerramento com pedidos, nenhuma mudança no app é necessária.

## Validação
- Funcional: `npx jest` (91 testes) e `npx tsc --noEmit` sem erros fora dos arquivos de teste.
- **Pendente**: teste em aparelhos reais (Android nativo, Chrome Android, Safari iPhone, PWA instalado) e comparação visual do bloco de status da Home com o protótipo (`docs/prototipo-motoboy`). Nenhuma das duas foi feita.
