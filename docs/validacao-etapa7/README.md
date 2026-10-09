# Etapa 7 — Auditoria do conjunto (08/10/2026)

Escopo real do que foi feito, dentro do que este ambiente permite (sem Postgres real, sem aparelho/emulador Android). Isto é **7.1 (auditoria estrutural)** parcial — não cobre fidelidade visual pixel a pixel, jornadas HTTP reais nem 7.3 (Android).

## O que foi feito

1. **Checklist corrigido**: as 9 linhas da Etapa 5 (chat, telas 28-35 e 61) estavam marcadas "Pendente"/"Código inicial" no `CHECKLIST-IMPLEMENTACAO.md`, desatualizadas desde a auditoria feita mais cedo na mesma sessão. Corrigidas para refletir o estado real (completo ponta a ponta nas 3 pontas).
2. **Varredura estrutural automatizada** (`audit-screens.cjs`, reaproveita o fixture de `docs/validacao-etapa5/browser-tests.cjs`): navega para 56 das 61 telas canônicas, em claro e escuro (390px), checando crash de render, overflow horizontal e erros de console/página. Resultado bruto em `results.json`, capturas em `captures/` (mantida só uma amostra — ver "Limpeza" abaixo).
3. **3 achados investigados e 2 bugs reais corrigidos** (ver abaixo).
4. **Varredura das 5 telas restantes** (`audit-remaining.cjs`): `home`/`online`/`pause` (sessão offline/online/pausada), `orders` (mapa com pedidos) e `pending` (conclusão aguardando confirmação, via rascunho salvo em `sessionStorage`). Resultado em `results-remaining.json`.

## Resultado final

- **61 de 61 telas canônicas cobertas** pela varredura estrutural (as 56 de `audit-screens.cjs` + as 5 restantes de `audit-remaining.cjs`: `home`/`online`/`pause`/`orders`/`pending`).
- **0 avisos de console remanescentes** em qualquer tela (eram 23 antes da correção do item 2).
- Das 61, **9 falham em Chrome headless por causa só do mapa** (item 1 abaixo): `map`, `route`, `navigate`, `arrive`, `return`, `online`, `pause`, `orders` e a tela `welcome` (falha isolada de compilação fria do Metro, não relacionada). Nenhuma delas tem erro de código — todas falham exatamente no componente de mapa (Mapbox GL), que depende de rede externa bloqueada no teste automatizado.
- As outras **52 telas abrem limpas**, claro e escuro, sem crash, sem overflow, sem aviso de console.
- `home` (offline, sem sessão) e `pending` (conclusão pendente salva) — as duas únicas das 5 que não dependem de mapa — abriram perfeitamente; capturas em `captures/10-home-*.png` e `captures/54-pending-*.png`.
- Ao revisar `entregaPendente.tsx` para montar esse teste, achei **mais uma ocorrência** do bug do achado 2 (`{completion.error&&...}`, sem `!!`) que não tinha aparecido na primeira varredura porque essa tela não estava incluída. Corrigida também.

## Achados

### 1. Mapa não carrega em Chrome headless (5 telas: `map`, `route`, `navigate`, `arrive`, `return`) — confirmado, é mesmo isso

Telas com `MiniRouteMap`/Mapbox falham com "Execution context was destroyed" em Chrome headless com rede externa bloqueada. Farley confirmou que é esperado ("deve ser isso mesmo"). **Não é bug de produto** — é limitação do método de teste automatizado (headless, sem Mapbox real). Precisa de verificação manual num navegador de verdade para validar o mapa de fato, fora do escopo desta rodada.

### 2. Aviso de console "Unexpected text node" — **bug real, corrigido**

Causa raiz: padrão `{error && <Feedback message={error} />}` onde `error` é `useState('')`. Quando `error` está vazio, `'' && X` retorna a própria string vazia (não `false`) — e essa string vira filho direto de uma `<View>`, que o React Native Web rejeita com esse aviso em desenvolvimento. Sem efeito visual (a string vazia não produz nó algum no DOM final, confirmado com `MutationObserver`), mas é um defeito real de código, repetido por cuidado insuficiente ao copiar o padrão em telas mais antigas.

Corrigido em **20 arquivos**, trocando `{x && ...}` por `{!!x && ...}` (ou equivalente) em todas as variações do padrão (`error`, `action.error`, `endError`, `rangeError`, `data.error`, `save.failure`, `save.success`, `completion.error`):

`configuracoes.tsx`, `documentos.tsx` (3 ocorrências), `mapa.tsx`, `privacidade.tsx`, `perfil.tsx`, `transferencia.tsx` (2), `retirada.tsx`, `rota.tsx`, `turno.tsx` (2), `acompanharTransferencia.tsx` (2), `somVibracao.tsx`, `recusarPedido.tsx`, `retornoLoja.tsx`, `dadosPessoais.tsx` (3), `minhaMoto.tsx` (3), `selecionarRestaurante.tsx`, `solicitarRestaurante.tsx`, `solicitacoesVinculo.tsx`, `convite/[id].tsx`, e `src/ui/CompletionKit.tsx` (o wrapper `CompletionScreen`, compartilhado pelas 6 telas de finalização de entrega — `confirmacaoEntrega`/`VerificationScreen`/`cobrarEntrega`/`dividirPagamento`/`comprovanteEntrega`/`entregaConcluida` — por isso aparecia nas 6 ao mesmo tempo).

Telas de etapas mais recentes (`acerto`, `ganhos`, `historico`, `resumoTurno`, `suporte`, `seguranca`, `pedido/[id]`, `oferta`) já usavam o padrão correto (`!!x &&`) desde o início — confirma que não era um erro sistemático do projeto todo, só das telas mais antigas (etapas 2-4).

Rodada de verificação depois da correção: **0 ocorrências do aviso** nas 56 telas, em claro e escuro.

### 3. Chips de resposta rápida "esticados" em `chat-group` — **não era bug real, era artefato da minha captura**

Investigado a fundo: inspecionei a altura real do elemento num viewport fixo (390×844, do jeito que o app realmente roda) e o chip mede **34px** — uma pílula normal e compacta. A aparência esticada só acontece na captura `fullPage: true` do Playwright, que redimensiona a página pra altura total do scroll antes de tirar a foto, e isso bagunça o cálculo de `flex` de alguns contêineres ao redor (não o chip em si). Ou seja: **o app está certo, meu script de auditoria que distorceu a imagem**.

Mesmo assim, apliquei um ajuste defensivo em `src/chat/CommunicationScreen.tsx` (`alignItems: 'center'` no `ScrollView` horizontal dos atalhos + `alignSelf: 'center'` no estilo do chip) — não muda nada no comportamento real (já estava correto), mas deixa o layout mais resistente a esse tipo de artefato no futuro. Retifico o que relatei antes: isso não era "realmente assim" no app de verdade, só na minha captura — registro aqui para não ficar um bug fantasma na documentação.

## O que falta para fechar a Etapa 7 de verdade

- Verificação manual do mapa num navegador de verdade, não headless (item 1) — as 9 telas com mapa precisam dessa conferência antes de considerar o conjunto validado.
- Comparação de fidelidade visual real contra o HTML aprovado (`index.html`/`styles.css`) — esta rodada verificou "não quebra, não vaza, sem aviso de código" nas 61 telas, não "está pixel a pixel igual ao protótipo". Ainda não feita.
- 7.2: jornadas entre app/API/admin com dado compartilhado de verdade — não é possível sem Postgres real neste ambiente.
- 7.3: Android físico (GPS, câmera, segundo plano, notificações, discador, Share) — não é possível sem aparelho/emulador neste ambiente. Continua inteiramente pendente, como em todas as etapas anteriores.

## Limpeza de capturas (08/10/2026)

As ~340 capturas PNG geradas pelas 3 rodadas da varredura (cada rerun regrava `captures/`) foram todas de confirmação "abriu sem erro" — sem valor de evidência individual além do que este documento já resume em texto. Mantida só uma amostra pequena (closeups dos 3 achados). O resto foi apagado a pedido do Farley, para não acumular espaço à toa.

## Escopo e limites

Teste com Expo Web + API totalmente simulada (dados mínimos plausíveis, não os dados ricos usados nas validações por lote anteriores). Não substitui os testes de interação mais profundos já feitos por etapa (ex. `docs/validacao-etapa5/browser-tests.cjs`, `docs/validacao-etapa6/browser-work.cjs`), que continuam sendo a referência para essas telas específicas. Chrome real (não Chromium do Playwright), headless.
