# Conta, turno, rota e finalização — 08/10/2026

Farley autorizou o lote 2.4 e as etapas 3 e 4 inteiras. O código está implementado localmente no app, na API e no ajuste necessário do admin. O HTML aprovado continua sendo a referência; não foi redesenhado para acomodar a implementação. Publicação, migrações em produção e nova aprovação visual em Android não foram realizadas.

## O que está implementado

| Lote | Comportamento e arquivos principais |
| --- | --- |
| 2.4 | Perfil próprio, foto, dados pessoais, moto, documentos privados, configurações, tema, movimento reduzido, som/vibração e Maps/Waze. `app/perfil.tsx`, `dadosPessoais.tsx`, `minhaMoto.tsx`, `documentos.tsx`, `configuracoes.tsx`; `services/accountApi.ts`, `accountImage.ts`; `src/ui/AccountKit.tsx`. |
| 3.1 | Início com dados da fila, ficar online, pausa persistida no servidor, retomada e encerramento protegido. O tracking existente continua desde online; pausa interrompe novas ofertas, não a posição de quem está em turno. `src/ui/HomeScreen.tsx`, `app/turno.tsx`, `src/contexts/OperationalSessionContext.tsx`. |
| 3.2 | Oferta com prazo e ID, aceite/recusa protegidos contra troca de oferta, sequência versionada, reordenação por gesto/acessibilidade e conferência de retirada em lote. O servidor revalida a lista e só marca os pedidos coletados após confirmação. `app/oferta.tsx`, `rota.tsx`, `retirada.tsx`; `services/routeApi.ts`; `src/ui/ReorderHandle.tsx`. |
| 3.3 | Mapa livre, pedidos, perspectiva e acompanhamento de posição/direção; Só mapa oculta painéis, pins, linha, bússola e controles dispensáveis. Mostrar controles restaura a interface. Navegação viária abre Maps/Waze conforme preferência. `app/mapa.tsx`, `components/Mapa.native.tsx`, `Mapa.web.tsx`, `services/navigation.ts`. |
| 3.4 | Retorno com endereço real da loja, ocorrência, cliente ausente, recusa permitida, transferência e acompanhamento/cancelamento, fila alterada/cancelada, conflito e oferta vencida. Motivos e orientação da loja antecedem registrar não entrega; a API confere o pedido atual. `app/retornoLoja.tsx`, `ocorrencia.tsx`, `clienteAusente.tsx`, `transferencia.tsx`, `acompanharTransferencia.tsx`, `estadoRota.tsx`; `src/ui/FailureAction.tsx`. |
| 4.1 | Chegada por ID, conferência autoritativa e código validado pelo servidor. Código validado permanece visível, verde e não editável. Abrir a tela ou validar código não entrega nem cobra. `app/chegadaEntrega.tsx`, `src/ui/FinishScreen.tsx`, `DeliveryCodeScreen.tsx`; `services/completionApi.ts`. |
| 4.2 | Dinheiro e troco, Pix, débito, crédito e divisão em duas formas. Cada parte exige confirmação explícita e soma exata em centavos. Pedido pago não recebe nova cobrança. `src/ui/ChargeScreen.tsx`, `SplitPaymentScreen.tsx`, `PaymentMethodSelect.tsx`, `src/delivery/completionRules.ts`. |
| 4.3 | Câmera/galeria, comprovante privado vinculado ao pedido, política de foto obrigatória, gesto de arraste e recibo real. Toque ou arraste parcial não concluem. O próximo pedido só aparece após confirmação da API. `src/ui/DeliveryProofScreen.tsx`, `CompletionKit.tsx`, `DeliverySuccessScreen.tsx`. |
| 4.4 | Conferência persistida antes do envio, chave idempotente, recuperação após resposta perdida, consulta de recibo pelo usuário e reenvio da mesma operação. Pendência bloqueia logout e mutações de rota. `src/contexts/DeliveryCompletionContext.tsx`, `app/entregaPendente.tsx`, `conexao.tsx`. |

## Como concluir uma entrega no app

1. Aceitar a oferta e abrir **Conferir retirada**. Conferir os pedidos e confirmar coleta; aguardar resposta do servidor.
2. Abrir o pedido atual e navegar até o cliente. Tocar **Cheguei**; a tela de chegada só prossegue depois do ACK.
3. Abrir **Conferir e finalizar**. Validar código se exigido, conferir recebimento se ainda não pago e anexar foto se a política exigir. Foto opcional também pode ser anexada.
4. Para dinheiro, informar quanto recebeu e entregar o troco. Para Pix/cartão, conferir o recebimento real antes de marcar. Na divisão, confirmar ambas as partes.
5. Voltar à conferência e arrastar até o fim. A API registra pagamento, entrega, fila, evento e recibo na mesma transação.
6. Havendo perda de resposta, usar **Consultar resultado**. Se não houver recibo, **Reenviar a mesma conferência** preserva chave, pedido e corpo originais. Não concluir outro pedido para tentar resolver a pendência.

`4821`, R$ 86,90 e os nomes usados pelo roteiro de QA são exclusivamente dados de teste. O app usa os dados do pedido real. Pix é conferência de crédito recebido e cartão é conferência na maquininha; esta etapa não cria gateway, cobrança automática ou QR fictício.

## Contratos e banco

Reutilizados: sessão, heartbeat, localização em lote, fila, hub/eventos, reorder, resume, chegada, retorno, recusa, transferências, canais existentes e `CompleteCurrentInternalAsync`. Coleta, pausa, oferta e não entrega ganharam proteções adicionais; nenhuma identidade de conta/loja vem do corpo.

Criados: perfil/veículo/documentos próprios, consulta da loja operacional, conferência/código/comprovante/finalização transacional e recibo próprio recuperável com token principal. Documentos recebidos não são marcados como aprovados. Fotos são privadas, limitadas e normalizadas, incluindo orientação EXIF; a leitura exige o proprietário.

Backend: `Controllers/MotoboyContaController.cs`, `MotoboyLojaController.cs`, `DeliveryCompletionController.cs`; `Repository/PedidoQueueRepository.TurnoColeta.cs`, `PedidoQueueRepository.Completion.cs`; `Service/MotoboyContaService.cs`, `DeliveryPickupRules.cs`, `DeliveryCompletionRules.cs`. Contratos e publicação em `../motoboyBackEnd/docs/ENTREGA-MOBILE-CONFERENCIA.md` a partir da raiz mobile.

Migrations preparadas e testadas apenas no PostgreSQL local isolado:

1. `20261008_01_motoboy_conta_documentos.sql`.
2. `20261008_02_delivery_completion.sql`.
3. `20261008_03_verify.sql`, verificação sem escrita.

Rollback em `rollback/20261008_01_02_conta_completion.down.sql`: recusa apagar tabelas que contenham recibos/fotos/documentos e mantém colunas aditivas. Não executar como limpeza de dados. O app novo precisa da API e dessas migrations; o endpoint legado de entrega passa a exigir o contrato novo para cliente mobile. O simulador mantém o caminho legado.

Admin: tipos e configuração de `requireDeliveryProof`, preservando o valor quando clientes antigos omitem o campo. Não foram adicionados financeiro, histórico ou chat da etapa 5/6 nesta rodada.

## Evidências e limites

- Backend: **949 testes passaram, nenhum ignorado**, com **23 testes de integração em PostgreSQL real local**, incluindo concorrência, replay, código, cobrança, fotos, isolamento, migrações e rollback. Não foi usado banco de produção.
- Mobile: TypeScript e exportação Web de 56 rotas passaram. Domínio de sessão/sincronização/finalização: 90 execuções, incluindo 22 casos de sessão carregados em ambos os arquivos; 68 casos distintos. Roteiros em `docs/validacao-etapa2/etapa34`.
- Expo Web real com API/WebSocket interceptados: navegação de 25 rotas em claro/escuro; código, dinheiro, divisão, foto, arraste, ACK perdido, recibo recuperado e reenvio idêntico. Oito telas críticas também passaram em 320 px nos dois temas. Logout pendente e registro local ilegível preservam dados/turno; nove grupos estão no `resultado.json` do roteiro final. Nenhuma mensagem, pagamento ou entrega real foi enviada.
- Componentes compartilhados: login/cadastro/restauração foram revistos novamente com seis grupos de cenários, incluindo 320/390 px, texto ampliado e movimento reduzido. Vínculos/convites passaram novamente em seis grupos; sessão/logout em cinco grupos e restauração do acesso em sete cenários. Contratos existentes reaproveitados; ver roteiros dos lotes anteriores.
- Admin: TypeScript e 12 verificações de delivery passaram. Não houve publicação do painel.
- Android: **APK compilado e instalado**, incluindo expo-image-picker. A execução ficou no DevLauncher, sem renderizar as novas telas. A revisão automática bloqueou a tentativa de trocar o servidor de desenvolvimento e inspecionar a conexão, informando somente `blocked by policy`. Não há aprovação visual nativa desta rodada.

Comparação visual: 24 capturas do HTML original e capturas do bundle Expo foram produzidas em claro/escuro com área de conteúdo de 390 px. Foram transpostos header, chave do login, campos, gradiente/reflexo do botão, fundo/luz efetivos do CSS noturno, passos de conferência, células de código, seletor da divisão, obturador e selo. Status bar/safe area do aparelho não são pixels do HTML. Esta conferência Web não substitui comparação Android no mesmo tema/largura, nem comprova toque, câmera, GPS/background, notificações ou desempenho no aparelho. Capturas e resultados locais estão em `.expo/validation-etapa34/`; os roteiros regeneram os arquivos.

O mapa interno mostra a sequência entre destinos por segmentos; não são ruas, instruções de conversão ou ETA calculado. A navegação viária usa Maps/Waze. A notificação local de oferta usa oferta real e permissão já concedida, mas push com app encerrado pertence à etapa 5. Os atalhos de contato reaproveitam os canais existentes; a comunicação completa ainda está pendente. Ganhos aparece na navegação conforme o desenho, desabilitado até a etapa 6, sem números inventados.

Falha ao ler o registro local impede sobrescrevê-lo e bloqueia logout enquanto a recuperação não puder ser conferida. Não limpar dados/reinstalar para resolver esse caso; preservar o registro e reconciliar com a loja. A proteção durante a leitura assíncrona do SecureStore precisa também do teste de retomada Android indicado abaixo.

## Próxima validação

1. Publicar API/migrations em ambiente de teste escolhido e apontar o app para ele; não usar pedidos reais para validar cobrança.
2. Abrir o APK no servidor de desenvolvimento correto pelo fluxo normal do Expo. Conferir telas Android contra o HTML no mesmo tema e largura.
3. Validar GPS parado/em movimento/background, permissão negada, Só mapa/modo rota, câmera/galeria, foto rotacionada, gestos, notificações e retomada após encerramento do processo.
4. Percorrer app/API/admin com dois motoboys de teste: oferta vencida/substituída, pausa, coleta, conflito, transferência, cancelamento, cobrança/código/foto e resposta perdida.
5. Prosseguir para etapa 5; etapa 6 e auditoria 7 continuam no inventário. Não transformar código presente em selo de produto publicado ou fidelidade nativa aprovada.

Sem novos commits, push, deploy ou alteração de banco de produção nesta rodada. O saldo de créditos não é acessível ao agente; este arquivo e CONTINUIDADE permitem retomar sem refazer a pesquisa.
