# ZippyGo web no iPhone — primeira versão

Implementação local de 10/10/2026. A web compartilha autenticação, sessão operacional e fila com o app, e abre Maps/Waze para navegar. Não exige Mac nem assinatura Apple para adicionar o site à Tela de Início.

## Localização e turno

- Iniciar um turno exige localização com o app aberto e acesso por HTTPS. A web não exige permissão de GPS em segundo plano.
- Ao abrir um turno ou retornar de Maps/Waze/tela bloqueada, solicita uma captura nova, com `maximumAge: 0`. Enquanto visível, mantém um watcher e consulta GPS a cada 15 segundos quando necessário. O filtro de envio continua em 10 segundos/10 metros em rota e 60 segundos/50 metros aguardando.
- Ao ocultar, remove watcher e timer. Capturas antigas, repetidas e callbacks de um turno anterior não são enviadas como posição atual.
- O envio passa pela fila existente, com sequência e confirmação do servidor. Falha de rede, timeout, heartbeat ou simples retorno à tela não zeram a idade da localização. Uma amostra reenviada conserva o horário original.
- Ao retornar, reconcilia a sessão e a fila do servidor. Uma permissão revogada durante um turno web pausa o GPS e apresenta aviso, mantendo os pedidos disponíveis para continuar o trabalho.
- O painel conserva o último ponto, inclusive depois dos dois minutos de frescor. Mostra sua idade nas listas, detalhes e marcadores e atualiza o tempo a cada 30 segundos sem depender de novas posições. GPS antigo perde a indicação visual de movimento e não conta como motoboy próximo da loja.
- Conexão e Privacidade no ZippyGo mostram a idade da última captura confirmada.

O backend recebe `clientPlatform: "web"` no início e guarda `device_type = 'web'` na tabela já existente. A origem e as regras de vínculo continuam sendo `mobile`. O turno e seu token têm uma janela própria de 12 horas, renovada por heartbeat, configurável por `DeliveryTracking:WebPresenceTtlSeconds`. Depois de 12 horas sem retorno, a sessão expira; encerramento/revogação/troca de sessão continuam validados no servidor. Apps nativos conservam seus prazos e permissões atuais.

**Horários:** o painel usa o horário da captura confirmada, não o horário de chegada de um lote antigo. `HasRecentLocation` informa frescor independentemente de `Location`, que conserva a última posição. Não inferir localização atual a partir do estado do turno.

## Publicar e instalar

1. Publicar o backend e o painel com estas mudanças. Uma API antiga ainda usa o timeout curto e pode apagar a posição velha do mapa.
2. Criar o projeto Vercel usando **zippygo-motoboy** como diretório raiz. `vercel.json` define `npx expo export --platform web`, saída `dist` e URLs sem extensão.
3. Configurar `EXPO_PUBLIC_API_BASE_URL` para a API HTTPS publicada e `EXPO_PUBLIC_BROWSER_MOCKS=false`. As variáveis Expo públicas entram no bundle: fazer novo build ao alterá-las.
4. Abrir a URL HTTPS pelo Safari do iPhone → Compartilhar → Adicionar à Tela de Início → habilitar abrir como app, se essa opção aparecer. O manifest e o ícone configuram a abertura independente.
5. Entrar, escolher a loja e permitir localização. Ficar online, abrir Maps/Waze, retornar e conferir no painel a nova posição e o intervalo anterior.

Não houve deploy nesta implementação. Não há service worker de cache nesta versão: abertura offline não está garantida e confirmações definitivas exigem internet. Push web, GPS em segundo plano e navegação nativa dentro do site não estão implementados. Adicionar à Tela de Início não habilita GPS com a tela bloqueada.

## Validação

- `npx tsc --noEmit` no mobile e `npm run typecheck` no admin.
- `node --test docs/validacao-web-ios/location-tests.cjs docs/validacao-etapa2/lote3/sync-tests.cjs`: 99 verificações passaram, incluindo concorrência, isolamento, fila e falhas.
- Testes Vitest de idade, mapeamento, card, base da loja e sobreposição de pins: 51 passaram.
- Backend: 61 verificações passaram em PostgreSQL local isolado e nas regras unitárias relacionadas; relatórios em `../motoboyBackEnd/obj/web-ios-validation/results/web-ios-relevant.trx`. Os testes novos confirmam a janela web, o GPS antigo no mapa e a preservação da entrega e dos horários durante heartbeat.
- A execução ampliada de 63 verificações encontrou duas falhas financeiras em `MotoboyWorkService.AddPeriod`: escrita de `DateTimeOffset` com offset `-03:00` em `timestamptz`. Esse trecho não foi alterado nesta tarefa. Relatório original: `web-ios.trx`, no mesmo diretório.
- `npx expo export --platform web --max-workers 2`: build concluído com 66 rotas. A variante `NativeNavigationProvider.web.tsx` impede importar o SDK de mapas nativo no navegador.

O roteiro `docs/validacao-web-ios/browser-tests.cjs` passou no bundle de produção com API interceptada e GPS controlado no Chromium: início, retorno, pausa, falha, recuperação da fila, permissões e configuração de instalação. Requer Playwright disponível no `NODE_PATH` e Chrome. O resultado está em [browser-results.json](validacao-web-ios/browser-results.json).

As capturas de [Conexão](validacao-web-ios/conexao-web.png) e [Permissões](validacao-web-ios/permissoes-web.png) foram revisadas visualmente em uma viewport de 390 × 844. A verificação funcional e essa revisão visual não substituem o teste no Safari/iPhone físico. Nenhuma coordenada ou pedido de teste foi enviado à API publicada.
