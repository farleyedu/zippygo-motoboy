# Continuidade — redesenho conceitual do ZippyGo

> Escopo atual (07/10/2026): somente visual mobile e integrações disponíveis; backend/painel sem alterações. A autorização histórica para editar os três projetos não vale para esta rodada. Etapa 1 e evidências: [ETAPA-1.md](ETAPA-1.md). Próximos contratos: [PENDENCIAS-BACKEND.md](PENDENCIAS-BACKEND.md).

> Rodada seguinte: Farley aprovou explicitamente iniciar a etapa 2 pelo lote 2.1 (boas-vindas, login, cadastro e recuperação). Não há autorização para backend/admin, commit, push ou publicação. As instruções fornecidas nesta conversa exigem inspeção somente para leitura e aprovação explícita antes de editar; prevalecem sobre a autoaprovação histórica descrita abaixo. Estado e evidências do lote: [ETAPA-2.md](ETAPA-2.md).

Lote 2.1 implementado e revisado em Web: quatro rotas de autenticação, `src/ui/AuthKit.tsx` e redirecionamento inicial em `app/index.tsx`. Login/cadastro reutilizam AuthContext/mobileApi sem editar esses arquivos no lote 2.1. TypeScript, exportação estática e whitespace passaram; seis grupos de cenários com API interceptada passaram, sem erros JavaScript. Claro/escuro, 390/320 px, texto ampliado, zero/um/dois vínculos, restauração e refresh foram verificados. Recuperação completa continua bloqueada por ausência de contrato.

Lote 2.2 aprovado depois de nova inspeção: seleção, busca/solicitação, andamento e convite em `app/selecionarRestaurante.tsx`, `app/solicitarRestaurante.tsx`, `app/solicitacoesVinculo.tsx` e `app/convite/[id].tsx`. Hook `src/hooks/useEstablishmentLinks.ts`, cartões `src/ui/EstablishmentKit.tsx`, rotas em `app/_layout.tsx` e proteções adicionais no AuthContext, preservando as alterações anteriores. Troca com contexto operacional local bloqueada; seleção simultânea e resposta com ID/token incoerentes também bloqueadas. Backend não verifica sessão/fila na seleção: registrar essa limitação, sem declarar garantia transacional ou em outro aparelho. Seis grupos do lote 2.2 e seis do 2.1 passaram; TypeScript, exportação estática, whitespace e capturas revisados. Evidências em `docs/validacao-etapa2/lote2/`. Próximo lote: 2.3 permissões/contexto de sessão, sujeito à aprovação de escopo nas instruções atuais. Android/API reais e lotes 2.3–2.4 continuam pendentes.

Atualizado em 07/10/2026. Pedido do Farley: pesquisar o mercado, compreender os três repositórios e entregar protótipos muito bem acabados, animados e navegáveis de TODOS os fluxos relevantes do app do motoboy. **Nova autorização: após fechar o plano, executar todas as telas e funcionalidades no app e backend; alterar também o admin quando necessário.** Reaproveitar endpoints e fotos do catálogo. O usuário reafirmou que quer exatamente o design e interações aprovados, com todas as funcionalidades faltantes. A restrição inicial de apenas prototipar deixou de valer. Tudo em português do Brasil.

## Escopo e restrições

- Repositórios: `C:/Users/farle/TI/Zippy/zippygo-motoboy`, `C:/Users/farle/TI/Zippy/zippy-admin`, `C:/Users/farle/TI/Zippy/motoboyBackEnd`.
- Pesquisa/protótipo/plano em `zippygo-motoboy/docs/prototipo-motoboy/`; implementação nos três repositórios conforme necessidade. Não sobrescrever mudanças anteriores. A pedido do usuário, os 14 arquivos já modificados foram salvos no mobile pelo commit **abd45b5**, fora dos documentos da pesquisa. Backend/admin estavam limpos. As alterações depois dessa base pertencem ao trabalho novo.
- O usuário quer uma identidade nova; usar a RIQUEZA de detalhes do admin, especialmente criar rota no chat, sem copiar sua paleta nem o layout atual do mobile.
- Obrigatórios: chat com cliente, estabelecimento, colegas e grupo; mapa livre; mapa com pedidos; finalização de pedidos caprichada; perfil; seleção de estabelecimento; configurações.
- Revisões recentes: **Só mapa**, para ocultar tudo que obstrui a visão enquanto dirige, e **modo rota** com acompanhamento. A paleta verde acinzentada foi rejeitada: usar a **nova paleta azul** em todas as telas, claro e escuro.
- Rastrear e transmitir a localização ao estabelecimento desde que o motoboy está online, inclusive sem rota. Compartilhamento com cliente é uma preferência separada.
- Não existe acesso ao saldo de créditos do usuário. Ele pediu este documento caso outra IA precise continuar.
- Não chamar agentes auxiliares: instrução vigente impede delegação sem pedido explícito.
- AGENTS.md do mobile exige pt-BR, plano/arquivos/diff, preservação das regras de negócio e comandos autoaprovados. Foi lido. Não requer confirmação para este trabalho.

## Fontes locais já examinadas

### Mobile

- `app/_layout.tsx`: login/cadastro, selecionar/solicitar estabelecimento, mapa, confirmar entrega, verificar código, dividir pagamento; nenhuma experiência completa de chat instalada na navegação.
- `services/mobileApi.ts`: vínculo e convites; sessão operacional com heartbeat; ofertas aceitar/recusar; fila reordenar/retomar; coletar/chegar/entregar/falhar; retorno à loja; enviar localização.
- `services/trackingService.ts`: modos `online_idle` e `active_route`; fila local de amostras. Há comportamento de perda potencial de parte da fila no flush. Com a nova autorização de integração, corrigir com teste pertinente, inclusive concorrência e isolamento de sessão.
- `app/confirmacaoEntrega.tsx`: confirmação atual muito simples. `app/dividirPagamento.tsx`: duas formas, troco e confirmação. `app/VerificationScreen.tsx`: código separado.
- `types/pedido.ts`: cliente/endereço/itens/observações/status/valores.

### Admin

- `src/features/delivery/chat/Despacho.module.css`: principal referência estética. Cartão com perspectiva 900px, inclinação via --rx/--ry, reflexo em --mx/--my; capas de pedidos empilhadas em profundidades diferentes; animações de chegada, halo, varredura, giro, desenho de rota. Não copiar as cores verdes.
- `src/features/delivery/chat/panel/DespachoTab.tsx`, `DespachoMap.tsx`, `DespachoEnviado.tsx`.
- `src/features/delivery/components/command/RouteComposer.tsx`: selecionar pedidos, ordem, primeiro/último fixos, distância/tempo, resumo e confirmação.
- `src/features/simulador/MotoboySimulador.tsx` e `src/features/delivery/simulator/SimulatedRider.tsx`: online, posição, oferta com validade, retirar, chegar, entregar com código, falhar, recusar, transferir, retomar fila, chat atendente, enviar cliente, grupo, compartilhar localização com cliente.
- `src/features/atendimento/atendimentoApi.ts`: mensagens texto/atalhos/leitura e grupo. Canal do cliente usa WhatsApp da LOJA e janela de atendimento; iFood/sem conversa/janela fechada precisam de estado indisponível. Não apresentar todas as conversas com clientes como já disponíveis.

### Backend

- `Controllers/MotoboyOnboardingController.cs`: cadastrar, listar estabelecimentos e solicitações, solicitar vínculo, aceitar/recusar convite.
- `Controllers/MotoboyTrackingV2Controller.cs`: sessão start/switch/get/heartbeat/location/end; queue; pickup/arrive/deliver/fail/refuse; oferta; reorder/resume/arrived-at-store; preferência compartilhar localização cliente; messages/read/shortcuts; client-messages; group-messages; transfers.
- `DTOs/Delivery/DeliveryOperationDtos.cs`: políticas de aprovação/reordenação/transferência/retorno/aceite. Diferenciar estados de política no protótipo.
- Chat direto entre motoboys, áudio, imagens, reações, comprovante fotográfico, ganhos/acerto e SOS são propostas de produto; não afirmar integração existente sem verificar.
- Regra do AGENTS: código obrigatório continua visível verde/desabilitado após validação; cobrança não é automática; finalizar só por arraste e após código + pagamento quando devidos. Não marcar pagamento ao abrir tela nem ao apenas selecionar método. Prototipar confirmação de recebimento preparada e commit ao concluir entrega. Servidor atual deliver recebe apenas código: reconciliação pagamento+entrega precisa contrato futuro.

## Pesquisa primária consultada

Consulta em 06/10/2026. Usar links diretos no documento e em pesquisa na apresentação. Sem copiar telas ou afirmar que recursos estrangeiros existem no Brasil.

- iFood — https://entregador.ifood.com.br/rota-de-ponta-a-ponta/ (indexação retornou etapas, códigos de coleta/entrega, bag, cliente não localizado, loja fechada e suporte. Abrir retornou 403; assumir apenas trechos verificáveis da busca.)
- iFood — https://entregador.ifood.com.br/jeito-ifood-de-entregar/ (código, verificação e cobrança por canal).
- DoorDash — https://dasher.doordash.com/en-ca/blog/how-to-use-dasher-app (guia de 20/08/2026: etapas, ofertas com distância/ganhos, navegação, prova fotográfica, ganhos, configurações, segurança e localização com contato de confiança. Contexto Canadá/EUA.)
- Uber — https://www.uber.com/us/en/deliver/earnings/ (ganhos e regiões com demanda, programa e promoções; contexto EUA).
- Uber — https://www.uber.com/pk/en/newsroom/new-safety-toolkit-arrives-pakistan/ (segurança centralizada, acesso pelo mapa e privacidade após viagem; fonte histórica/regional).

## Direção de design

Nome de conceito: ZippyGo — Seu próximo movimento.
Paleta atual: **azul vivo, branco luminoso, azul profundo e cobre/âmbar**. Substitui marfim/grafite/lima após o usuário rejeitar o verde acinzentado em 07/10. Botões com texto branco usam azul #2872e3 → #1854cd; fundo claro #f6f8fc, tinta #18243a; escuro #10192b com superfícies #1b2941. Verde permanece apenas como sinal de código validado, conforme regra de negócio. Mapa escuro como palco; superfícies claras e texto forte em chat, formulários e finalização. Tema noturno completo e movimento reduzido. Luz como sinal de estado, animação como feedback, 3D como profundidade de informação.

Apresentação desktop: barra lateral de capítulos, celular clicável ao centro, painel de contexto/estados à direita. Modos: protótipo, galeria de telas, mapa dos fluxos, pesquisa. Abrir por duplo clique em index.html (sem API/servidor). Fontes/ícones/assets locais para funcionamento offline.

## Plano de telas e estados

1. Boas-vindas; 2. entrar; 3. cadastro; 4. recuperar acesso; 5. permissões; 6. estabelecimentos; 7. buscar vínculo; 8. vínculo pendente/convite; 9. início offline; 10. início online; 11. mapa livre; 12. mapa com pedidos; 13. nova oferta; 14. organizar rota; 15. coleta/checklist; 16. navegação; 17. pedido/detalhes; 18. chegada; 19. finalizar; 20. código; 21. cobrar; 22. dividir; 23. comprovante; 24. sucesso; 25. próxima parada/retorno; 26. imprevisto; 27. cliente ausente; 28. transferência; 29. central chat; 30. chat loja; 31. chat cliente; 32. chat colega; 33. grupo; 34. detalhes grupo; 35. notificações; 36. histórico; 37. ganhos; 38. acerto; 39. resumo turno; 40. perfil; 41. editar perfil; 42. veículo/documentos; 43. configurações; 44. privacidade/rastreamento; 45. suporte; 46. segurança; 47. sem conexão/fila; 48. sessão expirada; 49. permissões negadas; 50. pedido cancelado; 51. pausa; 52. vínculos recusados e demais estados.

Não basta criar cards estáticos: permitir jornada conectada offline → online → oferta → aceite → coleta → navegação → chegada → código/pagamento → arraste → sucesso → próxima/retorno → acerto. Chats com envio local, atalhos, áudio/anexos simulados, estados de envio e menus. Permitir ver todos os estados diretamente na apresentação sem contaminar ações normais do app.

## Estado do trabalho

- Concluído: auditoria de repositórios e pesquisa; FLUXOS.md e PESQUISA.md; HTML/CSS/JS local; **61 telas compostas**, galeria completa, fluxos e pesquisa dentro da apresentação.
- Asset original de capacete 3D gerado pelo tool imagegen, copiado para `assets/capacete-3d.png`. Usuário viu, perguntou o propósito e aprovou. Em 07/10, editado pelo mesmo tool para trocar luz verde por azul, mantendo forma/transparência: `assets/capacete-3d-azul.png`, também copiado para assets nativos. O original foi preservado. Fonte Manrope local com licença OFL. Não depende de CDN para abrir.
- Simulações implementadas: acesso, vínculo, online, oferta, reordenação, coleta com checklist, mapas 2D/3D, código correto/incorreto, conferência de dinheiro/Pix/cartão/divisão/troco, foto ilustrativa, arraste, recibo/próxima/retorno; chat com texto/áudio visual/anexos/resposta/reação/localização/busca/presença/silêncio/fila/falha/reenviar; tema noturno, movimento reduzido; alterações externas e caminhos de exceção.
- Verificação inicial: Chrome headless pelo Playwright, todas as 61 telas e 61 cartões da galeria sem exceções JS, arquivos ausentes ou overflow interno horizontal. Inspeção visual de home, mapa, finalizar, chat, sucesso e galeria. Ajustado overflow da apresentação em 390 px e escala para desktop, seleção de pedidos e contexto de contatos, ordem da próxima entrega, conferência de troco na divisão.
- Revisão automatizada em `C:/Users/farle/.codex/tmp/zippy-prototype-review/` (Playwright instalado FORA do app; Chrome existente do sistema). Scripts de revisão e captura não pertencem ao app. Não foi instalado pacote ou alterado package.json no projeto.
- **Ponto atual:** protótipo azul de 61 telas, escuro refeito, detalhes ampliados e modos de mapa; implementação nativa iniciada. Fotos de pizza/refrigerante foram lidas do catálogo em transação somente leitura e copiadas localmente para manter HTML offline. Código inicial da etapa 1 pronto e revisado em Web/testes backend; integração real e Android ainda necessários. Etapas 2–7 pendentes em parte. Nenhum deploy, mensagem externa ou pagamento real. Não declarar que todas as 61 telas já existem no app.
- **GUIA-MOTORES-CLAUDE.md** criado com fontes oficiais de 07/10: Sonnet para execução, Haiku para tarefas mecânicas, Opus para decisões/revisões críticas. Preços de API não são conversão de percentuais de assinatura. Guia equivalente OpenAI: Sol execução, Luna tarefas delimitadas, Astra decisões complexas. O agente não altera o modelo da conta.
- Feedback do usuário em 07/10: aprovou as telas e interações, escolheu explicitamente **refazer o tema escuro**, depois pediu **mudar a paleta verde acinzentada**. A nova versão usa azul profundo, texto forte, separação de camadas, balões enviados azuis e recibo claro. Claro e escuro atualizados; não remover o tema escuro.
- Limites: mapa SVG é ilustrativo, envio/áudio/câmera/GPS/pagamento/documentos são simulações, estado é em memória. Tela acessada diretamente na apresentação pode mostrar etapa sem ter percorrido os pré-requisitos (para revisar o design); finalização interativa continua exigindo requisitos.

## Implementação real iniciada

- `src/ui/theme.tsx`, `src/ui/Kit.tsx`: paleta azul clara/noturna, preferências locais, movimento reduzido, Manrope, cartões com luz/profundidade e feedback de toque. `app/_layout.tsx` instala provider, fonte e novas rotas.
- `app/pedido/[id].tsx`: pedido nativo com etapas, cliente/endereço, observação, produtos/fotos reais, opções, valores, pagamento informado, requisito de código, contatos e chegada. Taxa do pedido não é apresentada como ganho do motoboy. Sem fotos, usa ícone; não inventa valores nem previsão. A finalização ainda encaminha para tela legada, que deve ser substituída na etapa 4.
- Backend: `MotoboyPedidoService`, `MotoboyPedidoDetalheDto`, endpoint `GET /api/v2/motoboys/me/session/orders/{id}`. Reutiliza `IPedidoConsultaRepository`; limita à fila/oferta do motoboy, revalida atribuição e não devolve código secreto.
- `app/conversas.tsx`: texto inicial para loja, cliente e grupo, histórico, rascunho, busca das mensagens carregadas e envio explícito. Canal do cliente respeita indisponibilidade/janela. Novos GET client-messages/client-channel e contacts reutilizam AtendimentoService e IConversationRepository. **Áudio, mídia, respostas, reações, colegas, paginação e fila idempotente não estão completos.**
- `app/index.tsx`, `components/Mapa.native.tsx`: Só mapa oculta sobreposições mantendo mapa montado; modo rota acompanha posição/direção e inclina a câmera. Alguns pins abrem o pedido nativo. **Não é navegação real curva a curva:** polilinha, trajetos e instruções reais continuam pendentes. Mapa.web continua sendo o stub legado.
- Chegada estendida com `expectedPedidoId` opcional, validado dentro da transação da fila; evita registrar chegada para outro pedido se a fila mudou. Clientes sem corpo continuam compatíveis. Alterações em DTO/controller/service/repository e DeliveryArrivalRules.
- `services/apiService.ts`: adapter usa `axios.getUri(config)` para preservar query params; removido log de corpo de requisição. Timeout/FormData e demais problemas legados ainda precisam revisão na etapa de mídia.
- Verificações: TypeScript passou; **48 testes backend selecionados passaram**, incluindo pedido, chegada, canal cliente e serviços existentes. Revisão Expo Web em 390 px passou com nove verificações, API inteiramente interceptada, envio e falha/rascunho. Nenhuma mensagem real enviada. Não substitui teste Android/GPS/câmera/notificações em aparelho.
- Arquivos novos e alterações de implementação estão sem commit, separados da base `abd45b5`. Admin ainda não foi alterado. Não iniciar API contra produção para aplicar migrations durante a revisão.
- Revisões locais: scripts Playwright em `C:/Users/farle/.codex/tmp/zippy-prototype-review/`: `variants-and-previews.cjs` (78 verificações), `review-blue-and-driving.cjs` (fotos/mapa), `native-review.cjs` (API mockada). Manter os scripts fora do app.

## Como continuar

Em 07/10, o usuário pediu o passo a passo para completar o projeto. **IMPLEMENTACAO.md** agora detalha sete marcos, lotes de duas a cinco telas por percurso, critérios de conclusão e publicação após validação. **CHECKLIST-IMPLEMENTACAO.md** acompanha todas as 61 telas canônicas. O próximo lote é **2.1: entrada/cadastro/recuperação**, seguido de vínculos e contexto operacional; conferir recuperação de acesso e contrato já existente antes de criar endpoints. Esta rodada organizou documentos e não adicionou funcionalidades ao produto.

Leia este arquivo, AGENTS.md e IMPLEMENTACAO.md. Não refaça pesquisa/inspeções concluídas sem motivo. Leia FLUXOS.md antes de alterar navegação. Atualize esta seção com progresso e o estado real das etapas. Teste especialmente regras de finalização, navegação de chats, estados offline, isolamento de loja e galeria. Não declarar a implementação completa enquanto telas/contratos pendentes existirem. Autorização de trabalho permanece válida; não perguntar novamente se pode criar endpoints ou mexer nos três projetos.
