# Validação do lote 2.3

07/10/2026. Telas Expo de preparação/permissões, permissão negada e sessão encerrada; contexto operacional compartilhado e logout antecipado a pedido do Farley. Backend/admin não foram alterados. Todos os dados destes testes são fictícios, todas as chamadas à API são interceptadas e solicitações externas são bloqueadas. O app continua usando os contratos existentes.

Resultado: **22 testes de domínio, TypeScript, exportação estática, whitespace e cinco grupos de cenários Web passaram**; nenhum erro JavaScript. Os seis grupos dos lotes 2.1 e 2.2 passaram novamente após a integração. Sem commit, push ou publicação.

Rodada posterior de sincronização: **52 testes (incluindo os 22 anteriores), TypeScript, exportações Web/Android e os 17 grupos Web passaram**. SignalR real testado contra servidor local, com evento/reconexão, e handshake/autenticação conferidos em conexão somente de leitura ao hub real (~1.350 ms). Não equivale a validar nova atribuição de pedido ou background em aparelho. Arquitetura, limites e mudanças em [SINCRONIZACAO.md](../../prototipo-motoboy/SINCRONIZACAO.md).

## Reprodução

Na raiz do mobile:

```powershell
node --test docs/validacao-etapa2/lote3/session-tests.cjs
node --test docs/validacao-etapa2/lote3/sync-tests.cjs
npx tsc --noEmit
npx expo export --platform web --output-dir docs/validacao-etapa2/lote3/bundle
$env:QA_OUTPUT='lote3/bundle'
$env:QA_PORT='8193'
node docs/validacao-etapa2/servir.cjs
```

Em outro terminal, com Playwright instalado no diretório de revisão (ou `QA_PLAYWRIGHT_MODULE` apontando para uma instalação existente):

```powershell
$env:QA_BASE_URL='http://127.0.0.1:8193'
node docs/validacao-etapa2/lote3/revisar.cjs
node docs/validacao-etapa2/revisar.cjs
node docs/validacao-etapa2/lote2/revisar.cjs
```

Os roteiros usam Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe`. `resultado.json` registra conclusão e cenários da revisão. A instalação de Playwright é somente uma ferramenta de revisão, sem dependência nova no aplicativo.

## Evidências visuais

- [Preparação clara](permissoes-claro-390.png), [escura em 320 px](permissoes-escuro-320.png) e [texto ampliado](permissoes-texto-ampliado-320.png).
- [Permissão negada](permissao-negada-escuro-320.png) e [sessão encerrada](sessao-encerrada-claro-390.png).
- [Confirmação de logout](logout-claro.png), [login após sair](login-apos-sair-claro.png) e [saída bloqueada por transferência](logout-end-conflict.png).

## Cobertura e limites

Testes de domínio executam a máquina de sessão e o serviço de rastreamento reais com dependências controladas. Cobrem permissões, idempotência do início, concorrência, resposta atrasada, isolamento por usuário/loja/sessão, fila recuperada, rede, expiração, bloqueios de encerramento, ordem da limpeza, fila de GPS e heartbeat em segundo plano.

A revisão Web verifica navegação, responsividade, temas, movimento reduzido, logout/cancelamento, reentrada, falhas e recuperação. No navegador, segundo plano não é liberado: Ficar online fica desabilitado e a tela explica que precisa do app instalado.

Não comprova GPS/background ou diálogos de permissão no Android, entrega de push, execução suspensa pelo sistema, integração com banco/API reais nem toda a etapa 2. Validar no aparelho: permitir/negar/revogar, GPS desligado, tela bloqueada, app reaberto com rota, perda de rede, mudança de sessão em outro aparelho e encerramento com pendências. Push completo e configurações/perfil pertencem aos próximos lotes.

## Rodada backend e GPS em lote

58 testes mobile (incluindo os 52 anteriores), TypeScript e exportação Android/Hermes passaram. Cenários adicionais: 100 posições em cinco HTTP, fallback para API antiga limitado, ACK incompleto/alheio preserva fila, rejeição/stale confirmados não bloqueiam posições válidas, contador ausente recuperado pelo servidor e sensores -1 normalizados. Backend: 911 testes, 13 com PostgreSQL real isolado. Commit/push autorizado apenas no backend; não houve nova revisão visual ou ações contra dados de produção.

## Correção da restauração do acesso

65 testes de sincronização, TypeScript, exportação Web e sete cenários do roteiro `auth-revisar.cjs` passaram. O roteiro executa o app real com API/WebSockets interceptados e bloqueia serviços externos: acesso legado sem refresh, refresh recusado, 401 persistente após renovar, novo login do mesmo usuário com turno pendente, refresh 503/rede com retry e restauração simultânea, e renovação automática bem-sucedida. Confere preservação de GPS/turno/seleção, limites de chamadas, credenciais após cada resultado e ausência de DELETE do turno ou erros JS. Dados fictícios apenas.

Reprodução na raiz mobile, depois de executar `node --test docs/validacao-etapa2/lote3/sync-tests.cjs` e `npx tsc --noEmit`:

```powershell
npx expo export --platform web --output-dir .expo/validation-auth/web
$env:QA_OUTPUT='../../.expo/validation-auth/web'
$env:QA_PORT='8195'
node docs/validacao-etapa2/servir.cjs
```

Em outro terminal, usando a instalação de revisão já disponível nesta máquina (ajustar `QA_PLAYWRIGHT_MODULE` em outra máquina):

```powershell
$env:QA_PLAYWRIGHT_MODULE='C:/Users/farle/.codex/tmp/zippy-prototype-review/node_modules/playwright'
$env:QA_BASE_URL='http://127.0.0.1:8195'
node docs/validacao-etapa2/lote3/auth-revisar.cjs
```

Resultados em `.expo/validation-auth/browser-results.json`, ignorados pelo Git. Conferência nativa separada: pacote Android de desenvolvimento com a correção retornou HTTP 200 e o emulador recarregado voltou ao mapa. Não foram digitadas credenciais nem acionados pedidos pelo agente; isso não prova novo login/expiração/rede ruim em Android físico. Sem mudança de layout ou backend e sem commit/push mobile. A divergência visual do login permanece aberta.
