# Etapa 6: trabalho e recuperacao

Implementacao local autorizada em 08/10/2026. Sem commit, publicacao, pagamentos reais ou migrations no banco de uso. Nao equivale a homologacao Android ou conclusao da etapa 7.

## Entregas

- 6.1: historico proprio por loja, filtros de periodo/ocorrencias, consulta de datas antigas em janelas de ate 93 dias, recibo e linha do tempo. Nao expoe nome, telefone, endereco completo, foto privada ou codigo secreto do cliente.
- 6.2: ganhos conferidos, regra definida pela loja, saldo pendente, dinheiro pertencente ao estabelecimento, acertos detalhados, contestacao, conferencia e confirmacao de recebimento. Resumo do turno respeita fila, ofertas, retorno e conclusoes pendentes.
- 6.3: solicitacoes persistentes para a loja, suporte contextual de entrega/acerto, contato de confianca local por conta, compartilhamento de aviso sem rastreamento e discadores 190/192. Nao promete atendimento imediato, despacho de emergencia ou localizacao ao vivo.
- 6.4: carregamento, vazio, erro/retry, falta de vinculo, operacao nao confirmada e conflitos financeiros. Ganhos/historico/suporte usam token principal e permanecem separados da validade do token do turno. Recuperacao operacional existente preservada.

## Remuneracao

O administrador configura em **Configuracoes > Delivery > Remuneracao**, selecionando o motoboy. Exige `Delivery/gestao_motoboy`; `Delivery/configurar` sozinho nao autoriza o financeiro. O motoboy consulta, mas nao escolhe nem altera a regra.

Modalidades implementadas: valor fixo por entrega, valor por km, hora, turno, diaria, semana, quinzena e mes. Nenhuma regra por bairro, remuneracao por rota, percentual, faixa de producao, hibrido, negociacao ou composicao de adicionais.

- Distancia reutiliza `pedido.distancia_km`, atualmente **linha reta**, nao trajeto de ruas ou GPS percorrido. A unidade aparece nas duas interfaces. Distancia ausente bloqueia atribuicao dessa modalidade.
- Entregas novas exigem regra da loja. A atribuicao congela a regra, distancia e valor por parada dentro da transacao da fila.
- Antes do aceite, a oferta mostra cada entrega e a soma das entregas. O total nao cria uma modalidade por rota. O aceite exige ID da oferta e mesma versao financeira; conflito pede revisao.
- Mudanca de tarifa nao reprecifica entregas ja atribuidas. Troca de modalidade com entregas/ofertas ativas e bloqueada.
- Somente entrega concluida gera lancamento; retirada/aceite nao geram credito. Conclusao repetida nao duplica ganho.
- Hora exige minutos efetivamente trabalhados informados pela loja, sem pausas, dentro do intervalo encerrado; nao transforma automaticamente tempo online em horas pagas.
- Turno: intervalo encerrado de ate 24h. Diaria: dia civil completo. Semana: segunda a segunda. Quinzena: 1 a 16 ou 16 ao proximo dia 1. Mes: 1 ao proximo dia 1. Calendario/inputs em Brasilia.
- Os periodos ficam dentro de uma unica ocorrencia de calendario da regra (um dia, uma semana, uma quinzena, um mes); nao podem cruzar para a ocorrencia seguinte (rejeitado, registre em duas partes). Dentro disso, sobreposicoes com outro lancamento ou com uma regra mais nova continuam rejeitadas.

**Decisao tomada em 08/10/2026 (sessao seguinte), respondendo a pergunta em aberto:** periodo parcial agora e proporcional, nunca fica sem remuneracao. Motoboy que comeca no meio de uma semana/quinzena/mes/diaria, ou cuja regra muda no meio, recebe a fracao do valor cheio correspondente aos segundos realmente dentro do periodo informado (ex.: 3 de 7 dias de uma semana de R$350 = R$150,00). Hora e turno nao mudaram (hora ja e granular pelos minutos informados; turno continua valor fixo por bloco declarado, sem proporcao). Implementado em `RiderPayRules.PeriodAmount`/`PeriodInstance` (`motoboyBackEnd/Service/RiderPayRules.cs`), persistido em `delivery_rider_work_entries.period_total_seconds`/`period_worked_seconds` (migration `20261008_10`). Para nao deixar duvida ao motoboy do porque do valor, cada lancamento por periodo mostra, nas duas pontas (app e admin), o valor do periodo completo, o equivalente por dia e quanto foi efetivamente trabalhado (`periodBreakdown` em `src/ui/WorkKit.tsx` no mobile e em `riderPayRules.ts` no admin) — testado em `RiderPayTests.cs` (unidade, com proporcao/arredondamento/cruzamento de ocorrencia) e `RiderWorkDatabaseTests.cs` (integracao, persistencia e leitura pelo motoboy).

## Acerto e recebimento

1. Loja gera acerto dos lancamentos ainda nao acertados. Valores desconhecidos ou recebimentos nao conferidos bloqueiam geracao.
2. Motoboy revisa os lancamentos ou registra divergencia. Loja nao pode marcar pagamento enquanto o acerto estiver sem conferencia ou contestado.
3. Loja registra pagamento efetivamente realizado com meio e referencia. **O sistema nao transfere Pix/dinheiro pelo banco.**
4. Motoboy confirma somente o pagamento que realmente recebeu; pode pedir ajuda quando nao recebeu.
5. Devolucao do dinheiro dos clientes e confirmada separadamente pela loja; nao compensa automaticamente o ganho do motoboy.

Dinheiro da loja e soma da parte confirmada em dinheiro, nao o valor bruto recebido do cliente antes do troco. Pedido previamente pago nao gera dinheiro a devolver. Cancelamento de acerto libera os lancamentos, sem apagar evidencia ou permitir duplicacao. Pagamento, recebimento e devolucao possuem trilha de eventos e protecao transacional.

## Arquivos

Mobile:

- `app/ganhos.tsx`, `historico.tsx`, `reciboHistorico.tsx`, `acerto.tsx`, `resumoTurno.tsx`, `suporte.tsx`, `seguranca.tsx`.
- `services/workApi.ts`, `src/hooks/useWork.ts`, `src/ui/WorkKit.tsx`, `src/ui/OfferEarnings.tsx`.
- Integracao em `app/oferta.tsx`, `turno.tsx`, `ajudaOperacional.tsx`, `_layout.tsx`, `src/ui/AccountKit.tsx`, `RouteKit.tsx`, `services/mobileApi.ts`.
- `src/chat/ChatNotices.tsx`: inicializacao do player somente apos montagem no Web, para evitar `Audio is not defined` no SSR; comportamento nativo preservado.
- Sessao seguinte (periodo parcial/backfill): `services/workApi.ts` (`periodTotalSeconds`/`periodWorkedSeconds`/`backfilled` no `WorkEntry`, `backfilled` no `HistoryEntry`), `src/ui/WorkKit.tsx` (`periodBreakdown`), `app/ganhos.tsx`/`acerto.tsx`/`historico.tsx`/`reciboHistorico.tsx` (mostram a explicacao do periodo parcial e o aviso de lancamento retroativo).

Admin:

- `src/app/components/apps/configuracoes/DeliveryOperationScreen.tsx`: aba na tela efetivamente usada pelo admin.
- `src/features/delivery/settings/tabs/RiderPayTab.tsx`, `riderPayRules.ts` e testes correspondentes.

Correcoes de completude feitas em 08/10/2026 (sessao seguinte), antes de considerar a etapa pronta:

- `RiderPayTab.tsx`: o backend ja devolvia `settlementEntries` (`Service/MotoboyWorkService.cs`), mas o admin so mostrava a lista solta "ultimos 90 dias", sem agrupar por acerto como o mobile ja fazia (`app/acerto.tsx`). Adicionado "Lancamentos deste acerto" dentro de cada card de acerto, igual ao mobile, para a loja ver exatamente o que compoe um acerto antes de confirmar o pagamento.
- `ConfiguracoesLanding.tsx`: o cartao "Delivery e operacao" so aparecia para quem tinha `Delivery/visualizar`; um usuario com `Delivery/gestao_motoboy` (mas sem `visualizar`) nao via o link pra chegar na aba Remuneracao, embora a aba em si ja checasse a permissao certa por conta propria. Corrigido para mostrar o cartao tambem com `gestao_motoboy`.
- `RiderPayTab.tsx`/`riderPayRules.ts`: botao "Aplicar regra atual aos pedidos antigos sem remuneracao" (backfill, com confirmacao e resultado explicito), `periodBreakdown` e aviso de lancamento retroativo nas duas listas de lancamentos (solta e por acerto). Texto da secao de periodo atualizado para explicar a proporcao em vez de prometer rejeitar parciais. `riderPayRules.test.ts` ganhou testes de `periodBreakdown`.

Backend:

- `Controllers/MotoboyWorkController.cs`, `Service/MotoboyWorkService.cs`, `RiderPayRules.cs`, `DTOs/Delivery/MotoboyWorkDtos.cs`.
- Hooks em `PedidoQueueRepository.cs`, `PedidoQueueRepository.Completion.cs`, DTO da fila, interfaces/service/controller do aceite e registro no `Program.cs`.
- `Tests/Unit/RiderPayTests.cs`, `Tests/Integration/RiderWorkDatabaseTests.cs`.
- Sessao seguinte: `RiderPayRules.PeriodAmount`/`PeriodInstance` reescritos (proporcao), `RiderPeriodQuote` novo em `MotoboyWorkDtos.cs`; `MotoboyWorkService.AddPeriod` grava `period_total_seconds`/`period_worked_seconds`; `MotoboyWorkService.Backfill` + `MotoboyWorkController`/`RiderWorkAdminController` (`POST .../backfill`); `Read()` passa `periodTotalSeconds`/`periodWorkedSeconds`/`Backfilled` nas entradas e `backfilled` no historico.

## Banco e compatibilidade

Scripts em `motoboyBackEnd/Migrations/Delivery/`:

- `20261008_08_motoboy_work.sql`: planos versionados, cotacoes, lancamentos, acertos, eventos e suporte; indice de historico.
- `20261008_09_verify_motoboy_work.sql`: verificacao de estrutura e integridade entre lojas.
- `rollback/20261008_08_motoboy_work.sql`: apenas tabelas vazias; bloqueia rollback com regras ou evidencias.
- `20261008_10_motoboy_work_periodo_parcial.sql` (sessao seguinte): acrescenta `period_total_seconds`/`period_worked_seconds` (seguranca do calculo de proporcao, com CHECK) e `backfilled_by` em `delivery_rider_work_entries`. Aditiva, `ADD COLUMN IF NOT EXISTS`.
- `20261008_11_verify_motoboy_work_periodo_parcial.sql`: confere as 3 colunas e a consistencia `period_worked_seconds<=period_total_seconds`.
- `rollback/20261008_10_motoboy_work_periodo_parcial.sql`: remove as 3 colunas; bloqueia se houver qualquer periodo parcial ou lancamento retroativo gravado.

Sem migration, a consulta financeira retorna indisponibilidade explicita e a fila legada permanece compativel. Com migration, configurar os motoboys antes de novas atribuicoes. Clientes antigos nao podem aceitar ofertas precificadas sem a versao exigida. Implantacao deve coordenar backend/admin/mobile.

Nao recalcular registros antigos com a tarifa atual automaticamente. Recebimentos desconhecidos permanecem pendentes e bloqueiam acerto.

**Decisao tomada em 08/10/2026 (sessao seguinte):** a loja pode aplicar a regra atual (por entrega ou por km) a pedidos antigos concluidos antes de existir remuneracao registrada, sob demanda, pelo botao "Aplicar regra atual aos pedidos antigos sem remuneracao" na aba Remuneracao do admin. `MotoboyWorkService.Backfill` (endpoint `POST /api/v2/delivery/rider-work/{rider}/backfill`) encontra entregas `completed` sem `delivery_rider_work_entries`, exige que a regra atual seja por entrega/km (regra por periodo e rejeitada com `RIDER_BACKFILL_MODE_INVALID`, pois nao faz sentido atribuir dia/semana a pedidos avulsos espalhados), usa a mesma cotacao (`RiderPayRules.Quote`) do fluxo ao vivo, e pula (sem falhar o lote) entregas sem distancia quando a regra e por km — nunca inventa um valor. **Nao inventa dinheiro do cliente**: grava so a remuneracao devida ao motoboy, com `store_cash=0` e `cash_confirmed=TRUE` (nao ha como reconstituir retroativamente quanto dinheiro do cliente foi de fato recebido em cada entrega antiga). Cada lancamento retroativo fica marcado (`backfilled_by`, coluna nova na migration `20261008_10`) e aparece identificado como tal para o motoboy (ganhos, acerto, historico, recibo) e para a loja (aba Remuneracao) — nunca se mistura silenciosamente com um lancamento capturado no momento real da entrega. Idempotente: rodar de novo nao duplica nem recalcula o que ja foi aplicado. Testado em `RiderWorkDatabaseTests.cs` (bloqueio sem plano, bloqueio com regra por periodo, calculo correto, idempotencia).

## Validacao local

- Backend (rodada original, 08/10/2026): **1.007 testes aprovados, zero ignorados/falhas**, incluindo PostgreSQL temporario isolado em porta 56439. Sem uso do banco 5432. Evidencia: `motoboyBackEnd/docs/validacao-etapa6/etapa6-full.trx`.
- Backend (sessao seguinte, periodo parcial + backfill): nesta sessao **nao havia PostgreSQL local disponivel** (ambiente diferente da rodada original) — `dotnet build` e `dotnet test` completo rodaram e deram **971 aprovados, 0 falhas, 40 pulados** (os pulados sao justamente os `[DeliveryDatabaseFact]` que exigem `TEST_DELIVERY_DATABASE`, entre eles os novos `WorkPartialWeekIsProratedPersistedAndVisibleToTheRider` e `BackfillPricesOldCompletedStopsWithoutInventingCashOrCrossingPeriodModes`, alem do `WorkMigrationVerifiesAndRollbackOnlyAllowsEmptyTables` estendido). A matematica de proporcao em si (`RiderPayRules`) foi validada sem banco em `Tests/Unit/RiderPayTests.cs` (25 testes, todos passando, incluindo arredondamento e cruzamento de ocorrencia). **Os testes de integracao do periodo parcial e do backfill foram escritos seguindo exatamente o padrao dos demais testes do arquivo, mas nunca foram executados nesta sessao** — precisam rodar contra um Postgres real (como a rodada original fez) antes de considerar essa parte coberta de ponta a ponta.
- Admin: cinco testes de regras/renderizacao/permissao aprovados.
- Mobile: seis testes de janela/calendario/ACK/contratos aprovados; onze testes de mocks nativos e quatorze testes de comunicacao aprovados.
- TypeScript mobile/admin: aprovado; repetir apos ultimas alteracoes antes da entrega.
- Oferta isolada no Expo Web: aceite envia ID/versao e trata 409 corretamente. Sem aceite no servidor real.
- Jornada Web completa (mobile) e fluxo admin (Web, API interceptada): **concluidos e aprovados em 08/10/2026**, numa sessao seguinte. Admin: `zippy-admin/docs/validacao-etapa6/browser-admin.cjs` (regra por entrega -> troca para hora -> conferencia de periodo -> geracao de acerto -> pagamento) rodou do inicio ao fim sem erro de console; evidencia em `browser-results.json` e `captures/admin-remuneracao.png`. A falha anterior (capturada em `captures/failure.png`, ja substituida) era do PROPRIO SCRIPT de teste, nao do produto: o nome acessivel calculado pelo MUI para um `Select` inclui o valor selecionado (ex. "Pagamento" vira "Pagamento Por entrega fixa"), entao o locator `getByRole('combobox', { name: 'Pagamento', exact: true })` nunca encontrava o elemento depois da primeira regra ser salva. Corrigido apontando para o nome acessivel completo. Nenhuma mudanca de comportamento do app foi necessaria para este ponto.

Scripts e evidencias auxiliares em `docs/validacao-etapa6/`. Testes de UI usam aplicacao real com autenticacao/API interceptadas; nao comprovam jornada HTTP integrada contra servidor real. WebSocket local do Metro permanece aberto para que o carregamento dinamico do mapa nao acione reload; WebSockets de negocio sao bloqueados.

## Pendencias reais

- Periodos parciais e reconciliacao de legado: **decididos e implementados** na sessao de 08/10/2026 (ver secoes acima). Falta rodar os testes de integracao novos (`WorkPartialWeekIsProratedPersistedAndVisibleToTheRider`, `BackfillPricesOldCompletedStopsWithoutInventingCashOrCrossingPeriodModes`, e a extensao de `WorkMigrationVerifiesAndRollbackOnlyAllowsEmptyTables`) contra um Postgres real — essa sessao nao tinha um disponivel.
- Aplicacao coordenada das migrations (incluindo as novas `20261008_10`/`11`) em ambiente de teste autorizado e jornada HTTP com contas reais de teste nas tres pontas.
- Android fisico: Share, discador, permissoes, acessibilidade/teclado e comportamento apos encerrar turno. Nao ha aparelho/SDK validado nesta rodada.
- Acoes nativas em navegador de desenvolvimento continuam marcadas como MOCK, sem GPS publicado, ligacoes ou fotos falsas enviadas. APIs de negocio nao viraram mocks no produto.

Servidor mobile local: `http://localhost:8198`. A copia estatica de QA nao e publicacao.
