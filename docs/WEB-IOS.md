# ZippyGo web no iPhone — primeira versão

## Disponibilidade, ofertas e escolha de navegação — 11/10/2026

Revisão adicional do recebimento prioritário e build `preview`: [OFERTAS-PRIORITARIAS.md](OFERTAS-PRIORITARIAS.md). Agora são 63 testes Node; os 36 cenários por navegador foram repetidos com prazo fixo no servidor de teste, comprovando que ocultar/reabrir não o renova. GPS revogado conserva recebimento/aceite/recusa de ofertas e a renovação do turno, sem liberar as demais ações de movimentação. Avisos conhecidos respondidos/vencidos são retirados do painel do sistema; reenvio web da mesma oferta não repete o alerta. O handler nativo responde sem aguardar armazenamento e confirma a apresentação no callback do sistema.

O turno e o login do motoboy permanecem ativos até sua escolha de sair/ficar offline, incluindo suspensão e abertura a frio em Android, iOS nativo e web. Retomada renova o acesso da mesma sessão e recupera a fila automaticamente. GPS permanece separado: web escondida não envia posição, e o painel conserva o ponto e a idade reais. Revogação, troca de aparelho e perda de vínculo continuam protegidas. A mudança exige publicar o backend e a migration de disponibilidade; uma API antiga ainda encerra o turno pelo timeout.

Oferta aparece sobre a tela atual, inclusive rota e conclusão pendente. Na rota, **Ocultar por enquanto** deixa um aviso para reabrir sem responder nem aumentar o prazo. Uma oferta nova volta a aparecer. Se houver conclusão pendente, o aceite aguarda sincronização e o próprio diálogo oferece essa ação. O mapa da navegação conserva seus destinos já aceitos quando chega a oferta.

Novo aceite: cabeçalho compacto, mapa no topo com todas as paradas disponíveis, ganhos totais das entregas selecionadas, valor individual, cliente e endereço por pedido. Tocar no pin ou endereço destaca a parada. Aceite parcial e recusa continuam explícitos. Ganhos ausentes ou por período não viram um total fictício. A linha do mapa representa **sequência**, não percurso pelas ruas; o navegador calcula o caminho. Essa composição foi solicitada pelo usuário e substitui o cabeçalho anterior do protótipo.

Após conferir e sair da loja, abre **Escolher navegador**, sem iniciar o SDK automaticamente. ZippyGo interno só inicia após escolha no APK compatível; Maps envia as paradas na ordem, dentro do limite do navegador/app; Waze recebe uma parada por vez. A escolha fica vinculada ao turno, permitindo retomar a navegação interna já escolhida. Endereços iguais geram uma única parada nos navegadores, conservando os pedidos e conferências separados. Endereço ausente não faz pular uma entrega silenciosamente. Fontes dos limites: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) e [Waze](https://developers.google.com/waze/deeplinks).

Push web de **ofertas** implementado com service worker e envio `aes128gcm`; não é cache offline nem push de chat. Ativar em **Configurações → Ativar avisos de novos pedidos**. No iPhone exige iOS 16.4+, instalação na Tela de Início e permissão; não exige conta Apple Developer paga. [Documentação Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). A revisão das permissões de GPS já prontas volta direto às configurações, onde fica a ativação dos avisos opcionais.

Publicação/configuração e testes de persistência/push: [DISPONIBILIDADE-E-OFERTAS.md](../../motoboyBackEnd/docs/DISPONIBILIDADE-E-OFERTAS.md). As três variáveis VAPID pertencem ao backend; o arquivo local gerado é privado e ignorado pelo Git. APK novo deve usar `eas build --platform android --profile preview`. Entrega real de notificações e navegação SDK no aparelho continuam exigindo homologação depois da atualização.

Validação desta rodada: TypeScript, exports web/Android, 51 testes Node, 78 testes backend relacionados e introspecção Expo das consultas Maps/Waze no Android/iOS passaram. Os 36 cenários de fluxo por motor Chromium/WebKit cobrem ambos os temas, com API/GPS/tiles controlados; os relatórios ficam em `validacao-web-ios/attention-flow-*-results.json`. Após o ajuste final de camadas/alinhamento do ganho total, seis cenários focados de oferta passaram por motor em `offer-review-*-results.json`; `QA_OFFER_ONLY=1` executa esse subconjunto sem substituir o relatório completo. Ganhos da oferta foram tratados como remuneração do motoboy. Revisão visual separada e descarte das capturas temporárias desta rodada; a pendência histórica de capturas bloqueadas permanece na continuidade. Sem deploy/EAS, teste de push real ou navegação em APK atualizado nesta execução.

## Fluxo simplificado e pins — 11/10/2026

Permissões já concedidas não exibem confirmação: início/retomada seguem direto à tarefa; revisão pelas configurações volta à origem sem abrir turno. Rota leva à etapa atual da fila, deixando organização opcional. Retirada confirma os itens comuns por sacola, destaca os escolhidos pela loja e pede resumo de saída somente quando existem esses itens. Código, cobrança/divisão e foto ficam na conferência final, com validações e gesto explícito preservados. Após confirmação do servidor, segue à próxima tarefa sem página obrigatória de sucesso; recibo, atualizações e transferências ficam acessíveis por avisos. Conclusão pendente permite leitura do mapa e chat, mantendo o bloqueio de alterações operacionais.

Pins numerados maiores, borda branca, gradiente e relevo; próximo destino azul e demais menores/cinza. A ponta coincide com a coordenada. Enquadramento da web considera a altura do marcador e a legenda do mapa pequeno. Android usa desenho dinâmico incorporado ao patch do SDK; não depende de PNG por parada.

Roteiro ampliado: [attention-flow-tests.cjs](validacao-web-ios/attention-flow-tests.cjs), API/GPS controlados, temas claro/escuro, viewport 390 × 844. Verifica primeiro acesso sem turno salvo, recuperação automática da fila com retry após falha, conferência por sacola, rejeição de manifesto alterado, código inline, dinheiro/troco e divisão, invalidação de recebimento após edição, falha sem avanço, reenvio com mesma operação, permissões sem criação de turno, teclado, retomada, ofertas, preservação do mapa e pins acima do rodapé. Simulação de teclado espera o rascunho ser gravado; arraste atravessa vários frames e verifica que o controle está visível. Capturas são opcionais via `QA_CAPTURE_DIR`, temporárias e apagadas após inspeção; relatórios JSON permanecem. As verificações de pixels em `map-layer-tests.cjs` usam captura em memória, sem salvar prints.

Esta evolução do fluxo e dos marcadores foi solicitada pelo usuário; não declara fidelidade integral ao HTML antigo. WebKit/Chromium de desktop e compilação Android não substituem homologação de teclado, câmera, GPS, notificações ou renderização nativa em aparelho. Novo APK/deploy permanece necessário para distribuir esta rodada.

Resultados desta rodada: TypeScript passou; exportação web concluiu 66 rotas; `:app:compileReleaseJavaWithJavac` passou com o patch dos pins. Os testes de sessão, conclusão, navegação e localização registraram 111 execuções aprovadas (alguns módulos compartilham o roteiro de sessão). Fluxo ampliado: 34 cenários passaram em cada navegador, sem erros JavaScript. O roteiro Chromium de GPS/início/retorno/falha/fila/permissões/instalação também passou, com seis envios interceptados. WebKit: seis cenários de camadas/cliques/pixels passaram, com tiles públicos e API de teste. Relatórios `attention-flow-{chromium,webkit}-results.json`, `browser-results.json` e `map-layer-webkit-results.json`. Revisão visual separada de seis capturas temporárias do início/pins, percurso e finalização nos dois temas, com tiles controlados; todos os prints desta rodada foram apagados após inspeção. Nenhuma entrega, mensagem, localização ou alteração de produção foi enviada pela validação.

Implementação local de 10/10/2026. A web compartilha autenticação, sessão operacional e fila com o app, e abre Maps/Waze para navegar. Não exige Mac nem assinatura Apple para adicionar o site à Tela de Início.

## Localização e turno

- Iniciar um turno exige localização com o app aberto e acesso por HTTPS. A web não exige permissão de GPS em segundo plano.
- Ao abrir um turno ou retornar de Maps/Waze/tela bloqueada, solicita uma captura nova, com `maximumAge: 0`. Enquanto visível, mantém um watcher e consulta GPS a cada 15 segundos quando necessário. O filtro de envio continua em 10 segundos/10 metros em rota e 60 segundos/50 metros aguardando.
- Ao ocultar, remove watcher e timer. Capturas antigas, repetidas e callbacks de um turno anterior não são enviadas como posição atual.
- O envio passa pela fila existente, com sequência e confirmação do servidor. Falha de rede, timeout, heartbeat ou simples retorno à tela não zeram a idade da localização. Uma amostra reenviada conserva o horário original.
- Ao retornar, reconcilia a sessão e a fila do servidor. Uma permissão revogada durante um turno web pausa o GPS e apresenta aviso, mantendo os pedidos disponíveis para continuar o trabalho.
- O painel conserva o último ponto, inclusive depois dos dois minutos de frescor. Mostra sua idade nas listas, detalhes e marcadores e atualiza o tempo a cada 30 segundos sem depender de novas posições. GPS antigo perde a indicação visual de movimento e não conta como motoboy próximo da loja.
- Conexão e Privacidade no ZippyGo mostram a idade da última captura confirmada.

O backend recebe `clientPlatform: "web"` no início e guarda `device_type = 'web'` na tabela existente. A origem e as regras de vínculo continuam sendo `mobile`. Com a migration de 11/10, a disponibilidade não expira por ausência de heartbeat, tanto na web quanto nos apps nativos. JWTs de acesso continuam curtos e são renovados pela retomada da mesma sessão; encerramento/revogação/troca de sessão continuam validados no servidor.

**Horários:** o painel usa o horário da captura confirmada, não o horário de chegada de um lote antigo. `HasRecentLocation` informa frescor independentemente de `Location`, que conserva a última posição. Não inferir localização atual a partir do estado do turno.

## Controles do mapa web — 10/10/2026

Corrigida a sobreposição dos tiles e panes do Leaflet sobre o painel da rota no tema claro. O elemento do mapa tem posição relativa, `zIndex: 0` e `isolation: isolate`: as camadas internas continuam ordenadas dentro dele, abaixo dos controles do app. Antes, um botão podia aceitar cliques mesmo estando visualmente coberto pelo mapa.

O painel web oferece **Conferir pedido**, **Conferir coleta** ou **Conferir retorno**, conforme a parada atual. Esses botões abrem os fluxos existentes; código, pagamento, conferências e confirmação da entrega continuam nessas telas. Após a retirada, `/mapa?navegar=escolher` abre a escolha de Maps/Waze; voltar ao app conserva os controles sem impor outra escolha.

Roteiro: `node docs/validacao-web-ios/map-layer-tests.cjs`, com Playwright no `NODE_PATH`. `QA_BROWSER=webkit` seleciona WebKit instalado; por padrão, usa Chrome. O roteiro verifica tanto pixels do botão quanto o elemento que recebe o clique, pois apenas a presença no DOM não detecta esta falha. Exerce arrastar, centralizar, retorno, menu, escolha do navegador e abertura das três conferências nos dois temas. A API e o GPS são controlados; a API de teste usa a mesma origem do servidor local.

TypeScript e build web passaram. As seis combinações de tema/parada passaram no [Chromium](validacao-web-ios/map-layer-chromium-results.json) e no [WebKit](validacao-web-ios/map-layer-webkit-results.json), sem erros JavaScript. [Prévia web no tema claro](validacao-web-ios/map-layer-webkit-light.png).

A reprodução anterior está em [map-layer-baseline-results.json](validacao-web-ios/map-layer-baseline-results.json) e [map-layer-before.png](validacao-web-ios/map-layer-before.png). `QA_EXPECT_COVERED=1` serve somente para o bundle anterior à correção, derivado do commit `8a76ff6`.

Revisão visual separada: referências HTML e capturas do app em 390 × 844, nos dois temas, ficam em `docs/validacao-web-ios/map-reference-*.png` e `map-layer-*.png`. Conferidos visibilidade dos controles, painel e rodapé e o mapa pequeno do retorno. Esta revisão não declara fidelidade completa ao protótipo: a web usa OSM e navegador externo, e acrescenta o acesso explícito às conferências. Homologação no iPhone físico e novo deploy continuam pendentes.

## Teclado, permissões e conferência — 10/10/2026

Os campos web usam pelo menos 16px, inclusive os dois chats, para evitar o zoom automático de foco no iPhone. O HTML conserva a escala do texto e contém a rolagem dentro do app. Enquanto o teclado reduz a área visível, `WebViewport` reserva a altura do `visualViewport` e oculta a navegação inferior; ao fechar, restaura o espaço e os botões. Zoom manual continua disponível. Marcar um item muda sua cor e estado acessível, mantendo a geometria; o rodapé também evita recalcular o layout por pequenas diferenças fracionárias.

Permissão negada apresenta instruções para liberar localização no Safari/Ajustes e um botão **Já permiti, verificar localização** que solicita o GPS de fato. Não oferece um botão web desabilitado para abrir configurações nativas. A tentativa de permissão na preparação também executa a solicitação; falha de rede na recuperação do turno conserva sua ação própria.

O painel configura **Cardápio → Gestão de produtos → Atenção do motoboy**. A conferência mostra produtos/adicionais escolhidos pela loja e suas quantidades por pedido. Ao confirmar a saída, abre um único resumo desses itens; se não houver nenhum, confirma diretamente. A chegada pelo detalhe do pedido abre a finalização. Código, cobrança e comprovante só ocupam etapas quando exigidos; o gesto final conserva as regras de conclusão. Links antigos de conferência extra retornam à tela principal. API e migration devem preceder os novos frontends: [ATENCAO-MOTOBOY.md](../../motoboyBackEnd/docs/ATENCAO-MOTOBOY.md).

Roteiro adicional: `node docs/validacao-web-ios/attention-flow-tests.cjs`, com Playwright no `NODE_PATH`; `QA_BROWSER=webkit` seleciona WebKit. Ele exercita o bundle real nos dois temas com API controlada: retirada sem/com destaques, agrupamento/quantidades, cancelamento sem perda de marcação, envio único, entrega sem etapas dispensáveis, toque versus arraste, bloqueio por requisitos e permissão negada/recuperada. A área do teclado é **simulada** pelo `visualViewport`. Evidências de desktop não substituem teste do zoom, teclado e permissões no Safari/PWA de um iPhone físico; também não comprovam renderização nativa Android/iOS. As telas usam as referências de fluxo/composição aprovadas, com simplificações autorizadas; não se declara fidelidade visual completa ao protótipo.

Links diretos de conversa aguardam a hidratação antes de selecionar o canal: o HTML estático não conhece a query e antes podia reconstruir a tela. As ações aguardam a gravação das marcações e oferecem atualizar os itens se a seleção mudar na loja, sem avançar uma retirada recusada. Capturas do resumo e chat em 390 × 844 foram revisadas; a limpeza solicitada pelo usuário está pendente por bloqueio da revisão automática dos comandos. Capturas em `validacao-web-ios/attention-*.png` e `keyboard-*.png`; relatórios em `validacao-web-ios/attention-flow-*-results.json`. O espaço vazio abaixo do chat correspondia à área reservada para o teclado simulado.

Nesta correção, TypeScript, export web e **127 testes mobile** passaram. **49 testes relacionados da API** passaram, incluindo PostgreSQL real isolado; duas falhas financeiras de offset UTC anteriormente documentadas foram excluídas dessa execução direcionada. No admin, TypeScript completo, lint dos arquivos alterados e **28 testes de API/adaptador** passaram. A opção de configuração teve sete cenários com o componente/adaptador reais e servidor controlado no Chromium: [evidência do painel](../../zippy-admin/docs/validacao-atencao-motoboy/results.json). O mapa manteve as seis combinações de tema/parada em cada motor. Os roteiros completos da conferência ficam em [Chromium](validacao-web-ios/attention-flow-chromium-results.json) e [WebKit](validacao-web-ios/attention-flow-webkit-results.json).

**14 cenários passaram em cada motor, sem erros JavaScript**, nos temas claro e escuro. A rodada inclui uma seleção alterada pela loja entre conferência e saída: o servidor recusa o manifesto antigo, o app mantém a retirada aberta e permite atualizar/conferir os itens antes de reenviar. As capturas do resumo e chat nos dois motores foram revisadas quanto a visibilidade e área útil; são evidência da implementação, não uma nova referência aprovada.

## Publicar e instalar

1. Publicar o backend e o painel com estas mudanças. Uma API antiga ainda usa o timeout curto e pode apagar a posição velha do mapa.
2. Criar o projeto Vercel usando **zippygo-motoboy** como diretório raiz. `vercel.json` define `npx expo export --platform web`, saída `dist` e URLs sem extensão.
3. Configurar `EXPO_PUBLIC_API_BASE_URL` para a API HTTPS publicada e `EXPO_PUBLIC_BROWSER_MOCKS=false`. As variáveis Expo públicas entram no bundle: fazer novo build ao alterá-las.
4. Abrir a URL HTTPS pelo Safari do iPhone → Compartilhar → Adicionar à Tela de Início → habilitar abrir como app, se essa opção aparecer. O manifest e o ícone configuram a abertura independente.
5. Entrar, escolher a loja e permitir localização. Ficar online, abrir Maps/Waze, retornar e conferir no painel a nova posição e o intervalo anterior.

Não houve deploy nesta implementação. O service worker é de notificações de ofertas, sem cache offline: abertura offline não está garantida e confirmações definitivas exigem internet. GPS em segundo plano e navegação nativa dentro do site não estão implementados. Adicionar à Tela de Início não habilita GPS com a tela bloqueada.

## Validação

- `npx tsc --noEmit` no mobile e `npm run typecheck` no admin.
- `node --test docs/validacao-web-ios/location-tests.cjs docs/validacao-etapa2/lote3/sync-tests.cjs`: 99 verificações passaram, incluindo concorrência, isolamento, fila e falhas.
- Testes Vitest de idade, mapeamento, card, base da loja e sobreposição de pins: 51 passaram.
- Backend: 61 verificações passaram em PostgreSQL local isolado e nas regras unitárias relacionadas; relatórios em `../motoboyBackEnd/obj/web-ios-validation/results/web-ios-relevant.trx`. Os testes novos confirmam a janela web, o GPS antigo no mapa e a preservação da entrega e dos horários durante heartbeat.
- A execução ampliada de 63 verificações encontrou duas falhas financeiras em `MotoboyWorkService.AddPeriod`: escrita de `DateTimeOffset` com offset `-03:00` em `timestamptz`. Esse trecho não foi alterado nesta tarefa. Relatório original: `web-ios.trx`, no mesmo diretório.
- `npx expo export --platform web --max-workers 2`: build concluído com 66 rotas. A variante `NativeNavigationProvider.web.tsx` impede importar o SDK de mapas nativo no navegador.

O roteiro `docs/validacao-web-ios/browser-tests.cjs` passou no bundle de produção com API interceptada e GPS controlado no Chromium: início, retorno, pausa, falha, recuperação da fila, permissões e configuração de instalação. Requer Playwright disponível no `NODE_PATH` e Chrome. O resultado está em [browser-results.json](validacao-web-ios/browser-results.json).

As capturas de [Conexão](validacao-web-ios/conexao-web.png) e [Permissões](validacao-web-ios/permissoes-web.png) foram revisadas visualmente em uma viewport de 390 × 844. A verificação funcional e essa revisão visual não substituem o teste no Safari/iPhone físico. Nenhuma coordenada ou pedido de teste foi enviado à API publicada.
