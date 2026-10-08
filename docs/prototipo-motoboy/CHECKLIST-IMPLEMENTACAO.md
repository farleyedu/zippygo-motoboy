# Checklist de implementação — 61 telas

> Estado vigente em 08/10/2026: lote 2.4 e etapas 3/4 com código integrado localmente no Expo/API e ajuste de política de foto no admin. [ETAPA-3-4.md](ETAPA-3-4.md) registra contratos, testes, migrations e limites. Login recomposto/revisado no Web; Android ainda não aprovado. **Nenhuma tela desta rodada é declarada validada integralmente em Android/API reais.**

Referência canônica: rawScreens em prototype.js e CSS efetivo; etapas/lotes em [IMPLEMENTACAO.md](IMPLEMENTACAO.md). Implementado significa código disponível e checks parciais; Pendente significa fluxo ainda por completar. Backend: 949 testes/23 PostgreSQL local. Expo Web usa API interceptada. APK compilado/instalado não comprova GPS, câmera, gesto ou fidelidade no aparelho.

Cada tela pertence a uma etapa principal. Recuperação de rede, permissões, cancelamento e conflitos também devem ser testados em todos os percursos em que aparecem. A etapa 7 audita o conjunto das 61 telas, sem adicionar telas ao inventário.

| Nº | Tela e ID canônico | Etapa | Código do novo visual | API e regras | Validação do novo fluxo |
| --- | --- | --- | --- | --- | --- |
| 01 | Boas-vindas · `welcome` | 2 | Implementado no Expo | Navegação e restauração da sessão existente | Web claro/escuro, 390/320 px; Android pendente — ETAPA-2.md |
| 02 | Entrar · `login` | 2 | Código funcional; composição recomposta pela referência | Login/vínculos/refresh existentes; chave/header/campos/gradiente transpostos | Web: autenticação/320–390 px/claro–escuro; Android/API reais pendentes |
| 03 | Criar conta · `register` | 2 | Implementado no Expo | /motoboys/cadastro reutilizado; confirma após resposta | Web com API interceptada: validação, conflito/retry e sucesso; API real/Android pendentes |
| 04 | Recuperar acesso · `recovery` | 2 | Estado indisponível implementado | Contrato de solicitação/redefinição não encontrado; envio desabilitado | Estado indisponível e retorno revisados em Web; recuperação completa bloqueada pelo contrato |
| 05 | Preparar o app · `permissions` | 2 | Implementado no Expo — lote 2.3 | Foreground/background/GPS e notificações opcionais; sessão existente; início após conferência | Domínio: início/retry/isolamento; Web claro/escuro, 390/320 px; Android/API reais pendentes — ETAPA-2.md |
| 06 | Escolher estabelecimento · `stores` | 2 | Implementado no Expo — lote 2.2 | Vínculos e seleção existentes; bloqueio conservador de troca com contexto operacional local | Web/API interceptada: seleção única, ID retornado e bloqueio; API real/Android pendentes |
| 07 | Solicitar vínculo · `link` | 2 | Implementado no Expo — lote 2.2 | Busca local e solicitação existente; estados reais | Web/API interceptada: busca/vazio, filtro, envio único, falha/retry; API real/Android pendentes |
| 08 | Solicitação de vínculo · `link-status` | 2 | Implementado no Expo — lote 2.2 | Solicitações/status/motivo existentes; aprovação não equivale a vínculo ativo | Web/API interceptada: pendente/recusada/aprovada e vínculo revogado; API real/Android pendentes |
| 09 | Convite recebido · `invite` | 2 | Implementado no Expo — lote 2.2 | Aceitar/recusar existentes; confirmação de recusa e resposta do servidor | Web/API interceptada: aceite/recusa, cancelamento, 404/retry e resposta atrasada; API real/Android pendentes |
| 10 | Início · offline · `home` | 3 | Implementado no Expo/API pertinente | Resumo real da fila e início protegido por sessão/permissões | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 11 | Início · online · `online` | 3 | Implementado no Expo/API pertinente | Tracking desde online; heartbeat/eventos/fila existentes | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 12 | Pausa do turno · `pause` | 3 | Implementado no Expo/API pertinente | Pausa persistida bloqueia novas ofertas e preserva localização/pedidos | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 13 | Mapa livre · `map` | 3 | Implementado no Expo/API pertinente | Mapa livre sem recenter periódico; GPS conforme plataforma | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes; GPS/navegação/background no aparelho pendentes |
| 14 | Pedidos no mapa · `orders` | 3 | Implementado no Expo/API pertinente | Pins da fila e Só mapa sem sobreposições | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes; GPS/navegação/background no aparelho pendentes |
| 15 | Nova rota · `offer` | 3 | Implementado no Expo/API pertinente | Prazo/ID da oferta revalidados no aceite/recusa | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 16 | Organizar rota · `route` | 3 | Implementado no Expo/API pertinente | Reorder versionado, gesto/acessibilidade e parada atual travada | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 17 | Conferir retirada · `pickup` | 3 | Implementado no Expo/API pertinente | Coleta versionada em lote, sem avanço antes do ACK | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 18 | Navegação · `navigate` | 3 | Implementado no Expo/API pertinente | Modo rota acompanha posição/direção; Maps/Waze para ruas; segmentos internos são sequência | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes; GPS/navegação/background no aparelho pendentes |
| 19 | Detalhes do pedido · `order` | 1 | Implementado no Expo/API pertinente | Consulta/chegada por ID, catálogo real e acesso à conferência | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 20 | Chegada ao cliente · `arrive` | 4 | Implementado no Expo/API pertinente | Chegada por ID e ACK antes de finalizar | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 21 | Finalizar entrega · `finish` | 4 | Implementado no Expo/API pertinente | Código/pagamento/foto/fila/recibo na mesma transação idempotente | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 22 | Código de entrega · `code` | 4 | Implementado no Expo/API pertinente | Código validado no servidor, verde visível desabilitado; revalidação no commit | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 23 | Receber pagamento · `charge` | 4 | Implementado no Expo/API pertinente | Dinheiro/troco/Pix/débito/crédito com confirmação; pedido pago não cobra | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 24 | Dividir pagamento · `split` | 4 | Implementado no Expo/API pertinente | Duas formas, confirmação de ambas e soma exata em centavos | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 25 | Comprovante da entrega · `proof` | 4 | Implementado no Expo/API pertinente | Câmera/galeria e foto privada; política autoritativa por loja/pedido | PostgreSQL local e Web com API interceptada; Android/API reais pendentes; EXIF testado no backend; câmera/galeria nativas pendentes |
| 26 | Entrega concluída · `success` | 4 | Implementado no Expo/API pertinente | Recibo imutável do dono; próximo somente após ACK | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 27 | Retorno à loja · `return` | 3 | Implementado no Expo/API pertinente | Endereço real da loja e arrived-at-store existentes | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 28 | Central de conversas · `chats` | 5 | Código inicial | Texto inicial; completar central/contadores | Pendente |
| 29 | Chat · estabelecimento · `chat-store` | 5 | Código inicial | Texto existente; completar histórico/mídia/interações | Pendente |
| 30 | Chat · cliente · `chat-client` | 5 | Código inicial | Leitura/canal adicionados; completar mídia/interações | Web simulado; integração/Android pendentes |
| 31 | Chat · outro motoboy · `chat-rider` | 5 | Pendente | Criar conversa privada; reutilizar vínculos/contatos | Pendente |
| 32 | Grupo da loja · `chat-group` | 5 | Código inicial | Texto existente; completar mídia/interações | Pendente |
| 33 | Detalhes do grupo · `group-details` | 5 | Pendente | Reutilizar roster; completar participantes/preferências | Pendente |
| 34 | Nova conversa · `contacts` | 5 | Pendente | Consulta operacional adicionada; completar seleção/canais | Pendente |
| 35 | Notificações · `notifications` | 5 | Pendente | Verificar eventos/push e persistência de leitura | Pendente |
| 36 | Histórico de entregas · `history` | 6 | Implementado localmente | Consulta própria por loja e datas, ocorrências, sem dados privados do cliente | SQL/testes locais; Web em validação; Android/API integrada pendentes; ETAPA-6.md |
| 37 | Recibo & linha do tempo · `history-detail` | 6 | Implementado localmente | Recibo autorizado e timestamps do servidor, sem código/foto privada | SQL/testes locais; Web em validação; Android/API integrada pendentes; ETAPA-6.md |
| 38 | Meus ganhos · `earnings` | 6 | Implementado com limites | Loja define modalidade, cotação congelada, saldo separado do dinheiro dos clientes, período parcial proporcional, entregas antigas aplicáveis sob demanda (backfill) | Testes SQL/regras unitários; testes de integração do período parcial/backfill escritos mas não executados nesta sessão (sem Postgres local); ETAPA-6.md |
| 39 | Acerto com a loja · `settlement` | 6 | Implementado localmente | Conferência, contestação, pagamento externo registrado e recebimento bilateral | SQL/idempotência/isolamento; jornada HTTP integrada pendente; ETAPA-6.md |
| 40 | Resumo do turno · `shift` | 6 | Implementado localmente | Ganhos registrados e encerramento existente com bloqueio de pendências | TypeScript/testes locais; Android/API integrada pendentes; ETAPA-6.md |
| 41 | Meu perfil · `profile` | 2 | Implementado no Expo/API pertinente | Perfil/foto próprios e logout por configurações | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 42 | Editar perfil · `edit-profile` | 2 | Implementado no Expo/API pertinente | PATCH próprio limitado, sem status/saldo/vínculo | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 43 | Minha moto · `vehicle` | 2 | Implementado no Expo/API pertinente | Moto própria com modelo/placa/ano validados | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 44 | Documentos · `documents` | 2 | Implementado no Expo/API pertinente | Upload privado; recebido não é aprovado | PostgreSQL local e Web com API interceptada; Android/API reais pendentes; EXIF testado no backend; câmera/galeria nativas pendentes |
| 45 | Configurações · `settings` | 2 | Implementado no Expo/API pertinente | Tema/movimento/som/vibração/Maps-Waze persistidos | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 46 | Localização & privacidade · `tracking` | 3 | Implementado no Expo/API pertinente | Compartilhamento por preferência existente e diagnóstico de tracking | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes; GPS/navegação/background no aparelho pendentes |
| 47 | Ajuda & suporte · `support` | 6 | Implementado localmente | Solicitação persistente por contexto e atalhos para conversa/segurança | SQL/idempotência; atendimento real/Android pendentes; ETAPA-6.md |
| 48 | Central de segurança · `safety` | 6 | Implementado localmente | Contato local por conta, aviso sem rastreamento, discador nativo/mock explícito | Domínio mock; Share/discador Android pendentes; ETAPA-6.md |
| 49 | Algo deu errado · `incident` | 3 | Implementado no Expo/API pertinente | Motivo/orientação da loja; expectedPedidoId dentro da transação | PostgreSQL local e Web com API interceptada; Android/API reais pendentes |
| 50 | Cliente não localizado · `absent` | 3 | Implementado no Expo/API pertinente | Canais existentes e decisão da loja; sem espera/contato fictícios | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 51 | Transferir pedido · `transfer` | 3 | Implementado no Expo/API pertinente | Alvos/políticas/transfer existentes, com confirmação | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 52 | Acompanhar transferência · `transfer-status` | 3 | Implementado no Expo/API pertinente | Acompanhamento/cancelamento existentes após ACK | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 53 | Sem internet · `connection` | 4 | Implementado no Expo/API pertinente | Rede/fila GPS reais; recuperação de conclusão isolada por dono | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 54 | Entrega pendente de envio · `pending` | 4 | Implementado no Expo/API pertinente | Persistência antes do POST; consulta por token principal; retry da mesma chave/corpo | PostgreSQL local e Web com API interceptada; Android/API reais pendentes; ACK perdido/restauração/retry mesmo corpo/logout em Web |
| 55 | Sessão encerrada · `expired` | 2 | Implementado no Expo — lote 2.3 | Conta preservada, turno reconciliado, recuperação e logout por contratos existentes | Domínio: 401/mudança/encerramento; Web: 401/sessão nula, retomada e logout; Android/API reais pendentes — ETAPA-2.md |
| 56 | Permissão necessária · `denied` | 2 | Implementado no Expo — lote 2.3, localização/GPS/notificações | Ajustes nativos e retorno à preparação; câmera será ligada a comprovantes/documentos | Web claro/escuro, 390/320 px; diálogos/ajustes Android pendentes — ETAPA-2.md |
| 57 | Pedido cancelado · `cancelled` | 3 | Implementado no Expo/API pertinente | Cancelamento pela fila/eventos e orientação de retorno | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 58 | Rota atualizada pela loja · `changed` | 3 | Implementado no Expo/API pertinente | Fila/eventos versionados e revisão da sequência | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 59 | Revisar sequência · `conflict` | 3 | Implementado no Expo/API pertinente | Conflito 409 preserva servidor e pede revisão | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 60 | Oferta encerrada · `offer-expired` | 3 | Implementado no Expo/API pertinente | Oferta vencida/substituída não aceita por ID antigo | Web/TypeScript e regras backend pertinentes; Android/API reais pendentes |
| 61 | Canal indisponível · `channel-unavailable` | 5 | Pendente | Canal/regras existentes; completar estado nativo | Pendente |

## Atualização ao concluir um lote

Registrar os IDs atendidos, caminhos dos arquivos mobile/backend/admin, contratos reutilizados/estendidos/criados, migrations, testes executados, ambiente e limitações. Atualizar esta matriz conforme a evidência: visual aprovado no nativo, interação completa, API integrada em ambiente de teste e Android validado quando aplicável.

Guardar capturas comparáveis de claro/escuro e verificar tipografia, tamanho de controles, espaçamento, profundidade, iluminação e movimento. Conferir texto ampliado, movimento reduzido, teclado, telas menores e acessibilidade conforme o lote.

Lote 2.4 e etapas 3/4 têm código e validações locais; integração real e fidelidade Android pendentes. Etapa 6 tem implementação local e limites em ETAPA-6.md. Etapa 5 tem alterações e evidências próprias em docs/validacao-etapa5; esta rodada não reaudita toda sua matriz. Etapa 7 permanece pendente. Não converter quantidade de telas em percentual de produto pronto.

