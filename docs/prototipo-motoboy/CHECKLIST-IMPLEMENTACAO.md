# Checklist de implementação — 61 telas

Atualizado em 07/10/2026. Referência canônica: `rawScreens` em `prototype.js`; etapas e lotes em [IMPLEMENTACAO.md](IMPLEMENTACAO.md). Todas as telas têm desenho no HTML aprovado com a paleta azul.

**Código inicial** significa que parte da nova tela/integração nativa existe; ainda precisa completar as interações e a revisão do lote. **Pendente** significa que o desenho aprovado ainda não foi implementado integralmente. Algumas telas têm versão legada: sua existência não comprova fidelidade ao protótipo.

A coluna API é um inventário do que existe e do trabalho previsto; não é um selo de integração concluída. Testes unitários e Expo Web com API interceptada são evidências parciais. Nenhuma tela foi registrada como validada integralmente em Android com app/API reais neste lote.

Cada tela pertence a uma etapa principal. Recuperação de rede, permissões, cancelamento e conflitos também devem ser testados em todos os percursos em que aparecem. A etapa 7 audita o conjunto das 61 telas, sem adicionar telas ao inventário.

| Nº | Tela e ID canônico | Etapa | Código do novo visual | API e regras | Validação do novo fluxo |
| --- | --- | --- | --- | --- | --- |
| 01 | Boas-vindas · `welcome` | 2 | Pendente | Navegação local | Pendente |
| 02 | Entrar · `login` | 2 | Pendente | Reutilizar autenticação e refresh | Pendente |
| 03 | Criar conta · `register` | 2 | Pendente | Reutilizar /motoboys/cadastro | Pendente |
| 04 | Recuperar acesso · `recovery` | 2 | Pendente | Verificar contrato e completar recuperação | Pendente |
| 05 | Preparar o app · `permissions` | 2 | Pendente | Permissões do sistema e sessão | Pendente |
| 06 | Escolher estabelecimento · `stores` | 2 | Pendente | Reutilizar vínculos e seleção de loja | Pendente |
| 07 | Solicitar vínculo · `link` | 2 | Pendente | Reutilizar busca/solicitação de vínculo | Pendente |
| 08 | Solicitação de vínculo · `link-status` | 2 | Pendente | Reutilizar solicitações e estados | Pendente |
| 09 | Convite recebido · `invite` | 2 | Pendente | Reutilizar aceitar/recusar convite | Pendente |
| 10 | Início · offline · `home` | 3 | Pendente | Reutilizar sessão; conectar resumo real | Pendente |
| 11 | Início · online · `online` | 3 | Pendente | Reutilizar sessão/heartbeat/location | Pendente |
| 12 | Pausa do turno · `pause` | 3 | Pendente | Verificar regra de pausa e persistência | Pendente |
| 13 | Mapa livre · `map` | 3 | Código inicial | Reutilizar tracking; Android pendente | Pendente |
| 14 | Pedidos no mapa · `orders` | 3 | Código inicial | Reutilizar fila; câmera/pins iniciais | Pendente |
| 15 | Nova rota · `offer` | 3 | Pendente | Reutilizar ofertas/aceite/recusa | Pendente |
| 16 | Organizar rota · `route` | 3 | Pendente | Reutilizar reorder/version/policies | Pendente |
| 17 | Conferir retirada · `pickup` | 3 | Pendente | Reutilizar pickup; conferir contrato de volumes | Pendente |
| 18 | Navegação · `navigate` | 3 | Código inicial | Câmera inicial; integrar trajetos e instruções | Pendente |
| 19 | Detalhes do pedido · `order` | 1 | Código inicial | Consulta restrita adicionada; integrações finais pendentes | Backend + Web simulado; integração/Android pendentes |
| 20 | Chegada ao cliente · `arrive` | 4 | Pendente | Reutilizar arrive com proteção do ID adicionada | Regra do ID testada; fluxo/Android pendentes |
| 21 | Finalizar entrega · `finish` | 4 | Pendente | Estender transação de entrega/cobrança | Pendente |
| 22 | Código de entrega · `code` | 4 | Pendente | Criar validação antecipada usando regra existente | Pendente |
| 23 | Receber pagamento · `charge` | 4 | Pendente | Completar registro explícito de recebimento | Pendente |
| 24 | Dividir pagamento · `split` | 4 | Pendente | Completar contrato da divisão e conciliação | Pendente |
| 25 | Comprovante da entrega · `proof` | 4 | Pendente | Verificar upload existente; vínculo/política por pedido | Pendente |
| 26 | Entrega concluída · `success` | 4 | Pendente | Recibo confirmado pelo servidor | Pendente |
| 27 | Retorno à loja · `return` | 3 | Pendente | Reutilizar retorno/arrived-at-store | Pendente |
| 28 | Central de conversas · `chats` | 5 | Código inicial | Texto inicial; completar central/contadores | Pendente |
| 29 | Chat · estabelecimento · `chat-store` | 5 | Código inicial | Texto existente; completar histórico/mídia/interações | Pendente |
| 30 | Chat · cliente · `chat-client` | 5 | Código inicial | Leitura/canal adicionados; completar mídia/interações | Web simulado; integração/Android pendentes |
| 31 | Chat · outro motoboy · `chat-rider` | 5 | Pendente | Criar conversa privada; reutilizar vínculos/contatos | Pendente |
| 32 | Grupo da loja · `chat-group` | 5 | Código inicial | Texto existente; completar mídia/interações | Pendente |
| 33 | Detalhes do grupo · `group-details` | 5 | Pendente | Reutilizar roster; completar participantes/preferências | Pendente |
| 34 | Nova conversa · `contacts` | 5 | Pendente | Consulta operacional adicionada; completar seleção/canais | Pendente |
| 35 | Notificações · `notifications` | 5 | Pendente | Verificar eventos/push e persistência de leitura | Pendente |
| 36 | Histórico de entregas · `history` | 6 | Pendente | Auditar histórico existente e consulta do próprio motoboy | Pendente |
| 37 | Recibo & linha do tempo · `history-detail` | 6 | Pendente | Reutilizar auditoria; expor recibo autorizado | Pendente |
| 38 | Meus ganhos · `earnings` | 6 | Pendente | Auditar financeiro/taxas e consulta do próprio motoboy | Pendente |
| 39 | Acerto com a loja · `settlement` | 6 | Pendente | Auditar acertos; divergência e confirmação pelas partes | Pendente |
| 40 | Resumo do turno · `shift` | 6 | Pendente | Resumo real; encerramento respeita pendências | Pendente |
| 41 | Meu perfil · `profile` | 2 | Pendente | Reutilizar perfil com acesso do próprio usuário | Pendente |
| 42 | Editar perfil · `edit-profile` | 2 | Pendente | Reutilizar validações; acesso do próprio usuário | Pendente |
| 43 | Minha moto · `vehicle` | 2 | Pendente | Reutilizar dados e validações do perfil | Pendente |
| 44 | Documentos · `documents` | 2 | Pendente | Auditar upload/análise/permissões existentes | Pendente |
| 45 | Configurações · `settings` | 2 | Pendente | Preferências locais iniciais; completar tela/integrações | Pendente |
| 46 | Localização & privacidade · `tracking` | 3 | Pendente | Reutilizar preferências/location; reparar fila e diagnóstico | Pendente |
| 47 | Ajuda & suporte · `support` | 6 | Pendente | Reutilizar atendimento e contexto | Pendente |
| 48 | Central de segurança · `safety` | 6 | Pendente | Completar contato de confiança e avisos reais | Pendente |
| 49 | Algo deu errado · `incident` | 3 | Pendente | Reutilizar fail/refuse; completar orientações e motivos | Pendente |
| 50 | Cliente não localizado · `absent` | 3 | Pendente | Reutilizar canais/falha; conferir espera e decisão da loja | Pendente |
| 51 | Transferir pedido · `transfer` | 3 | Pendente | Reutilizar transfer-targets/transfer/policies | Pendente |
| 52 | Acompanhar transferência · `transfer-status` | 3 | Pendente | Reutilizar acompanhamento e cancelamento | Pendente |
| 53 | Sem internet · `connection` | 4 | Pendente | Completar fila local, isolamento e reconexão | Pendente |
| 54 | Entrega pendente de envio · `pending` | 4 | Pendente | Completar conclusão idempotente e reconciliação | Pendente |
| 55 | Sessão encerrada · `expired` | 2 | Pendente | Reutilizar autenticação; reconciliar sessão/fila | Pendente |
| 56 | Permissão necessária · `denied` | 2 | Pendente | Permissões do sistema e retorno contextual | Pendente |
| 57 | Pedido cancelado · `cancelled` | 3 | Pendente | Reutilizar eventos/fila; orientar devolução | Pendente |
| 58 | Rota atualizada pela loja · `changed` | 3 | Pendente | Reutilizar eventos e versão da fila | Pendente |
| 59 | Revisar sequência · `conflict` | 3 | Pendente | Reutilizar controle de versão; revisão da ordem | Pendente |
| 60 | Oferta encerrada · `offer-expired` | 3 | Pendente | Reutilizar prazo/estado autoritativo da oferta | Pendente |
| 61 | Canal indisponível · `channel-unavailable` | 5 | Pendente | Canal/regras existentes; completar estado nativo | Pendente |

## Atualização ao concluir um lote

Registrar os IDs atendidos, caminhos dos arquivos mobile/backend/admin, contratos reutilizados/estendidos/criados, migrations, testes executados, ambiente e limitações. Atualizar esta matriz conforme a evidência: visual aprovado no nativo, interação completa, API integrada em ambiente de teste e Android validado quando aplicável.

Guardar capturas comparáveis de claro/escuro e verificar tipografia, tamanho de controles, espaçamento, profundidade, iluminação e movimento. Conferir texto ampliado, movimento reduzido, teclado, telas menores e acessibilidade conforme o lote.

O progresso atual é **base visual e integrações iniciais**, com as demais jornadas ainda em execução. Não converter número de telas com código inicial em percentual de produto pronto.

