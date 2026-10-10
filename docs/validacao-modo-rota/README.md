# Modo rota — implementação e validação de 09/10/2026

## Correção de Centralizar (09/10/2026)

O marcador de posição ficava encoberto pelo rodapé ao retomar o acompanhamento. No SDK React Native instalado (0.16.3), `NavViewManager.setMapPadding` encaminha números diretamente para `GoogleMap.setPadding`, que recebe pixels físicos no Android. A altura medida pelo `onLayout` estava em unidades de layout; no emulador de densidade 2,625, a reserva era menor que a sobreposição real. `components/SdkMapa.tsx` agora converte as margens com `PixelRatio.getPixelSizeForLayoutSize` apenas no Android e mantém pontos no iOS. A conversão acompanha mudanças na altura do rodapé e libera a margem inferior ao sair do modo rota. Referência: [padding do Navigation SDK](https://developers.google.com/maps/documentation/navigation/android-sdk/reference/com/google/android/gms/maps/GoogleMap#setPadding(int,int,int,int)).

- **Validação funcional:** `npx tsc --noEmit` passou; 11 testes de `sdk-bootstrap-tests.cjs` e `navigation-tests.cjs` passaram. A regressão cobre densidades Android 1, 2,625 e 3, pontos no iOS, altura fracionária e saída para a prévia.
- **Validação visual Android:** emulador 1080 × 2400, densidade 420 dpi. App recarregado; rota ativa; mapa arrastado; toque em Centralizar retomou a câmera com o marcador inteiro acima do rodapé. Capturas reais em `C:/Users/farle/.codex/tmp/zippy-recenter-20261009/`: `before.png`, `exploring.png` e `verified.png`. São evidência desta correção, não novas referências visuais aprovadas. iOS permanece sem validação visual.
- Durante a recarga houve `QUOTA_CHECK_FAILED`; o cálculo seguinte retornou `OK` e permitiu verificar a centralização com orientação ativa. Isso não comprova resolução definitiva do erro de cota nem do `NETWORK_ERROR` investigado anteriormente. Não houve mudança em credenciais, destinos, GPS do emulador, perfil de transporte ou regras de entrega.

Os registros abaixo descrevem as rodadas anteriores; a validação acima cobre especificamente a centralização.

**Atualização posterior ao print de preparação:** bootstrap de GPS e identidade do controller corrigidos; teste Android desbloqueou a preparação, mas o cálculo nativo retorna `NETWORK_ERROR`. A rota ainda não foi homologada. Evidências e investigação em [CORRECAO-INICIALIZACAO.md](CORRECAO-INICIALIZACAO.md).

Referências: as duas imagens de navegação enviadas pelo Farley e as decisões registradas em `docs/prototipo-motoboy/DOSSIE-MODO-ROTA-MAPS-WAZE.md`. Manter paleta azul e tipografia Manrope aprovadas. Comandos por voz e compartilhar viagem por link ficam fora do escopo.

## Mudanças implementadas

- `app/mapa.tsx`: condução separada da prévia operacional. Durante condução, não renderiza cards, cliente, produtos, valores, lista de pedidos ou CTA de conferência. Cabeçalho de manobras real do SDK e rodapé próprio com endereço, minutos, metros/km, chegada e Sair.
- `src/ui/NavigationChrome.tsx`: rodapé compacto nos temas existentes, Centralizar/Voltar a acompanhar, silenciar instruções e estados claros de preparação, erro e chegada. Instruções faladas são preservadas; isso não é comando por voz.
- `components/SdkMapa.tsx`: roteiro de duas rodas, destinos com endereço, marcador nativo, cabeçalho persistente e padding conforme altura real do rodapé. Remove pins operacionais da condução. Usa a linha real do percurso nativo, contínua como nas referências; não cria linha reta entre destinos nem sobreposição inventada. Acabamento literal tracejado não foi acrescentado, pois não é exposto pela API de polylines instalada.
- Explorar com arraste/pinça não reinicia guidance nem força a câmera de volta. Centralizar retoma a perspectiva do SDK; ela continua usando autozoom, sem zoom fixo próprio.
- `src/delivery/navigationJourney.ts`: fila serializada de comandos, invalidação de operações antigas e confirmação de início antes do estado guiding. Nenhum overview concorre com o início de acompanhamento. Falha não vira orientação ativa por callback de tempo/distância.
- Blur da tela não encerra guidance. Desmontagem, chegada e saída explícita têm encerramento ordenado. Barreira em `NativeNavigationProvider` impede nova inicialização antes de terminarem comandos de descarte anteriores. Não declara continuidade garantida se o sistema destruir a tela/processo.
- Chegada para guidance, sem concluir entrega ou pular conferência. Novo destino exige nova fila operacional. Nenhuma alteração de pagamento, código, checklist, upload, autorização, envio de GPS ou endpoints.

## Verificações executadas

- `npx tsc --noEmit`: passou após correção do título do destino para campos existentes no tipo Pedido.
- 8 testes novos do coordenador: cálculo/início, explorar/centralizar, sair enquanto calcula, sair enquanto inicia, falha/ETA, chegada e novo destino, desmontagem com início pendente e formatação de resumo.
- Testes operacionais/finalização existentes executados junto dos novos: 35 passaram.
- Regressões de autenticação, chegada, conferência e mapa legado executadas junto dos novos: 20 passaram. Os 8 novos se repetem nesses totais; não somar como se fossem casos distintos.
- Revisão visual de NavigationChrome real via React Native Web: 8 combinações, temas claro/escuro, larguras 360/390 e estados orientação/erro. Sem overflow horizontal; controles visíveis; sem conteúdo de pedido. Mapa e cabeçalho SDK nessa revisão são fixtures explicitamente identificadas, não evidência de navegação nativa.

```powershell
npx tsc --noEmit
node --test docs/validacao-modo-rota/navigation-tests.cjs
node docs/validacao-modo-rota/review-chrome.cjs
```

O roteiro visual usa o Chrome e uma instalação existente de Playwright fora do repositório; permite trocar `QA_PLAYWRIGHT_MODULE` e `QA_OUTPUT`. Artefatos desta rodada em `C:/Users/farle/.codex/tmp/zippy-navigation-20261009/`.

## Limitações reais de homologação

O emulador conectado exibia um diálogo Android **Application Not Responding** para `com.farleyedu.zippygomotoboy`, na tela de retomada de sessão, antes de navegar para testar a nova tela. Captura `before.png`. Não foi encerrado app, apagada sessão nem alterado GPS para contornar o bloqueio. Portanto **câmera, header nativo, voz, malha para moto, precisão de chegada e transição real entre destinos continuam pendentes de homologação Android**; iOS também não foi validado.

O wrapper instalado captura erros de `setFollowingPerspective` e `setNavigationUIEnabled` sem propagá-los ao chamador. Os testes verificam nosso coordenador; só o teste no aparelho pode comprovar a câmera real. Nenhuma atualização de pacote ou alteração desse wrapper foi feita nesta rodada.

Investigação posterior registrada em [DIAGNOSTICO-LENTIDAO.md](DIAGNOSTICO-LENTIDAO.md). Há evidências de pressão de memória e ANRs no Android; a causa dos timeouts autenticados permanece sem confirmação. O Farley pediu análise e explicação, sem aplicar otimizações de desempenho.

## Rastreamento temporário do cálculo (09/10/2026)

Farley confirmou que o Google Maps calcula normalmente no mesmo emulador. Isso não valida as credenciais do nosso SDK, mas reduz a suspeita de indisponibilidade geral do GPS/internet.

Os logs JS `[Navegação][Diagnóstico]` estão restritos a `__DEV__`. `attemptId` agrupa a inicialização; `operationId` distingue comandos dentro dela. Registram estado do app, plataforma, permissões consultadas sem diálogo, serviço de localização, GPS, reset, opções nativas, cálculo, guidance e eventos de chegada/recalcular. Operações pendentes são sinalizadas em 5, 15 e 30 segundos; os timers apenas observam, sem cancelar/repetir comandos. Desmontar a tela limpa os timers e identifica operações interrompidas. Não registrar endereço, pedido, sessão, coordenadas ou chaves.

Reproduzir com o app atualizado e guardar o bloco desde `bootstrap.begin` até `route.result`/`route.exception`. Logo após a falha, capturar o transporte nativo:

```powershell
& ./docs/validacao-modo-rota/capturar-sdk-android.ps1
```

O script usa ADB, apenas lê o processo atual e filtra mensagens do SDK/transporte com remoção de credenciais, URLs e coordenadas. Não exige recompilar o Android, não limpa logcat e não reinicia o app. A captura depende dos registros que o SDK nativo realmente emitir; ausência de linhas não prova ausência de falha.

Na captura realizada, o processo apresentou um aviso de fallback Cronet e erros `JavaUrlRequest: java.net.ProtocolException: unexpected end of stream` às 23:30:58 e 23:42:20 UTC. São pistas do transporte, sem correlação comprovada com o cálculo que falhou às 23:45:51 UTC. Não declarar causa encontrada nem alterar dependências com base apenas nesses registros.

Após confirmar a causa e validar a correção, retirar probes públicos, observação detalhada de ambiente/permissões e timers temporários; conservar resultado, duração e código de falha do cálculo. Essa redução ainda não ocorreu porque a causa permanece em investigação.

### Encerramento concorrente do GPS em segundo plano

O log posterior contém `bootstrap.dispose` da tentativa anterior, seguido de rejeições `TaskNotFoundException` de `ExpoLocation.stopLocationUpdatesAsync`. Não contém um novo resultado de cálculo; não explica o `NETWORK_ERROR` por si só.

`locationSetup` e `trackingService` tinham consultas e paradas independentes da mesma tarefa. Agora `backgroundLocationLifecycle` serializa reinício e parada no mesmo runtime. Se outra execução remover a tarefa entre consulta e parada, apenas a exceção específica de tarefa ausente é tratada como sucesso, após confirmar que ela realmente não está mais ativa. Outros erros continuam rejeitando. A proteção não altera credenciais, regras de presença ou envio de GPS. Quatro testes cobrem concorrência, remoção externa, propagação de erro real e parada durante reinício.
