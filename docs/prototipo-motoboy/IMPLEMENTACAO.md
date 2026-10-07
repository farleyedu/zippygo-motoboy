# Implementação do app aprovado

Atualizado em 07/10/2026. **Autorizado pelo Farley: implementar todas as telas e funcionalidades do protótipo no app e backend, ajustando também o admin quando necessário.** Reaproveitar endpoints, catálogo e regras existentes. A autorização inicial de somente prototipar foi substituída por essa autorização. Não fazer deploy nem testar enviando mensagens/pagamentos reais.

## Referência obrigatória

- Visual e interações: `index.html`, `styles.css`, `prototype.js`, capturas em `previews/`.
- Jornada, exceções e políticas: `FLUXOS.md`.
- Acompanhamento por tela: `CHECKLIST-IMPLEMENTACAO.md`. Distinguir desenho, código inicial, API e validação em aparelho; uma tela bonita no HTML não conta como tela entregue no app.
- Inventário canônico: as **61 entradas de `rawScreens`** em `prototype.js`. Cada tela deve ter correspondente nativo e estados pertinentes, incluindo as telas de exceção. Não reduzir a quantidade para entregar um MVP.
- Manter o desenho aprovado com a **nova paleta azul**, solicitada em 07/10: branco luminoso, azul vivo, azul profundo e cobre. Claro e escuro foram atualizados. A tela de detalhes do pedido foi ampliada a pedido do usuário. As fotos dos produtos vêm do catálogo existente.
- Dados fictícios ficam exclusivamente no protótipo HTML. A versão nativa usa a API e mostra indisponibilidade quando houver erro, canal fechado ou dados ausentes.

## Base Git separada

Commit do mobile **`abd45b5`**, `chore: salva ajustes anteriores ao plano de redesenho do motoboy`: 14 arquivos, 918 adições, 209 remoções. Contém as mudanças que já existiam antes da pesquisa. `docs/prototipo-motoboy/` ficou fora desse commit. Backend e admin estavam limpos. As alterações feitas a partir dessa base pertencem à implementação nova e devem ficar separadas dos documentos de pesquisa.

## Contratos existentes e reaproveitamento

As URLs abaixo incluem `/api`. O cliente mobile já tem `BASE_URL` terminando em `/api`, portanto passa caminhos sem esse prefixo.

| Jornada | Contrato já existente | Trabalho para completar |
| --- | --- | --- |
| Entrar e recuperar sessão | Auth/login, refresh; `AuthContext`, `apiService` | Aplicar telas aprovadas sem perder renovação e armazenamento |
| Cadastro, lojas e convites | `/motoboys/cadastro`, `/motoboys/me/estabelecimentos-disponiveis`, `/motoboys/me/vinculos/*`, `/auth/estabelecimentos*` | Confirmar URLs em `apiConfig`, estilizar todos os estados, não trocar loja com entrega ativa |
| Online desde a espera | `/v2/motoboys/me/session/start`, GET/DELETE sessão, heartbeat/location | Contexto operacional único; rastreamento `online_idle` desde online e `active_route` durante rota; reparar fila local |
| Mapa livre e pedidos | Sessão/queue, coordenadas da fila; `Mapa.native` | Mapa nativo persistente, pins, seleção, perspectiva e navegação externa; sem recriar mapa ao selecionar pin. Só mapa oculta sobreposições e mantém rastreamento; modo rota acompanha posição/direção. Câmera de acompanhamento inicial integrada; trajeto e instruções reais ainda pendentes |
| Oferta, rota e coleta | queue/offer/accept/reject, queue/reorder/resume, stops/current/pickup | Validade, conflito de versão, ordem travada, checklist e políticas do servidor |
| Detalhes e fotos | Admin `GET /v2/delivery/pedidos/{id}` usa `IPedidoConsultaRepository.GetAsync`; `pedido_item.produto_id` → `cardapio_produto.imagem_url` com estabelecimento | Leitura operacional restrita implementada em session/orders/{id}, reutilizando esse repositório. Não devolve o código secreto; revalida pedido atribuído à fila/oferta do motoboy |
| Chegada | stops/current/arrive | Proteção de expectedPedidoId implementada dentro da transação da fila, compatível com clientes antigos. Notificação única por destino e revisão completa do fluxo ainda pendentes |
| Finalização | stops/current/deliver recebe código; transação existente em `PedidoQueueRepository` | Validação separada de código + conclusão com pagamento/divisão/prova e idempotência na mesma transação. Estender a transação existente; não duplicar máquina de fila |
| Imprevistos | stops/current/fail, stops/{id}/refuse | Motivo, confirmação, distinção coleta/recusa e recuperação |
| Transferências | transfer-targets, stops/{id}/transfer, transfers, DELETEtransfers/{id} | Direta/aprovação/desativada, acompanhamento; usar contratos atuais |
| Loja e grupo | session/messages GET/POST/read/shortcuts; session/group-messages GET/POST; `AtendimentoService` | Telas nativas, paginação, leitura, busca, rascunhos, fila de envio/idempotência, respostas/reação/mídia |
| Cliente | session/orders/{id}/client-messages POST, WhatsApp da loja; `AtendimentoService.SendToClientAsync` | Adicionar leitura e canal para pedido autorizado; usar histórico existente de conversa. Respeitar iFood, sem conversa e janela fechada; não criar WhatsApp pessoal paralelo |
| Outros motoboys | Roster já existe em `AtendimentoService.ListMotoboysAsync` | Expor contatos operacionais e criar conversa privada com autorização dos dois vínculos na mesma loja, leitura, mídia e eventos |
| Perfil e veículo | Perfil existente em gestão, `MotoboyPerfilDtos`, serviços/repositórios; avatar Cloudinary existente | Acesso do próprio usuário sem poder editar outra pessoa nem status administrativo; reaproveitar dados e validações |
| Privacidade | session/preferences GET/PATCH | Compartilhar com cliente separado da localização obrigatória para loja enquanto online |
| Históricos, ganhos e acerto | histórico de pedido/fila e módulos financeiros existentes | Consultas do próprio motoboy, taxas reais, período, saldo e confirmação de acerto; não inventar ganhos nem marcar quitação unilateralmente |
| Configurações e acessibilidade | Preferências locais + dados compartilhados no servidor | Claro/noturno, movimento reduzido, som/vibração, avisos, sessão, permissões e logout seguro |
| Segurança e suporte | Atendimento/contatos + abertura do discador | Contato de confiança, aviso real ao estabelecimento, caminhos de emergência; nenhum SOS com sucesso fictício |

## Execução e critérios por etapa

1. **Base nativa e pedido:** tokens, Manrope, tema, movimento, componentes com profundidade; tela detalhada com fotos reais; endpoint restrito e testes de autorização. A partir daí, usar os mesmos componentes nas demais telas.
2. **Conta e sessão:** acesso, onboarding, lojas/convites, perfil, veículo/documentos, preferências; contexto de turno compartilhado. Comprovar troca de loja segura e encerramento/expiração.
3. **Turno e rota:** início, online, mapas, oferta, ordenar, checklist, navegação, chegada, retorno e pausa. Comprovar tracking na espera, tratamento de permissões e conflito de fila.
4. **Entrega e cobrança:** validar código no servidor sem concluir; manter campo verde desabilitado; escolha explícita, dinheiro/troco e divisão; prova; concluir por arraste com revalidação e idempotência. Reenvio não conclui o pedido seguinte. Pendência não libera próxima entrega.
5. **Comunicação completa:** loja, cliente, colegas e grupo; histórico, canais, atalhos, texto, áudio, fotos, resposta, reação, busca, lido, fila, retry, participantes e notificações. O admin precisa receber/renderizar os mesmos anexos e eventos da loja/grupo.
6. **Trabalho e recuperação:** histórico, ganhos, acerto, resumo do turno, suporte/segurança, offline, sessão expirada, negadas, canceladas e todos os estados restantes do inventário.
7. **Fidelidade e integração:** percorrer todas as 61 telas, comparar capturas nativas com protótipo no claro e escuro; conferir tamanhos, hierarquia, luz, profundidade, movimentos e feedback. Validar com fonte de dados local/testes. Documentar teste Android em aparelho necessário para GPS/câmera/notificações reais.

## Como executar sem perder o controle do escopo

As sete etapas são marcos maiores. Dentro de cada uma, trabalhar em **um percurso completo por lote**, normalmente duas a cinco telas relacionadas. Exemplo: selecionar loja → preparar permissões → ficar online. Exceções que dependem desse percurso acompanham o lote: vínculo recusado, localização negada, sessão encerrada e falha de rede. Não esperar o final das 61 telas para testar integrações ou comparar o visual.

Para cada lote:

1. Selecionar os IDs canônicos do checklist e conferir no protótipo o visual, os gestos, a animação, os destinos e as regras. Definir o que comprova a conclusão antes de escrever código.
2. Localizar endpoints, serviços, repositórios e eventos existentes. Registrar o que será reutilizado, estendido ou criado. Conferir como o admin usa o mesmo recurso.
3. Fechar o contrato entre app e servidor: dados de entrada/saída, permissões, estados de erro e eventos. Quando necessário, criar migration versionada. Identidade e loja vêm da sessão; pedido e vínculo são revalidados.
4. Implementar as regras no backend usando os serviços e transações existentes. Conferir compatibilidade com mobile/admin atuais e executar testes pertinentes às mudanças.
5. Implementar as telas nativas com os componentes visuais aprovados e conectar à API. Tratar carregamento, vazio, indisponibilidade, rede, cancelamento e retorno à tela. Preparar as animações e o movimento reduzido no mesmo lote.
6. Percorrer o fluxo com app e API de teste, conferindo também o que aparece no admin. Comparar capturas com o protótipo nos temas claro/escuro. Testar em Android as funcionalidades que dependem de GPS, segundo plano, câmera, áudio ou notificações.
7. Atualizar checklist e CONTINUIDADE com arquivos, contratos, testes e pendências. Separar alterações de produto dos documentos e preparar um diff por lote. Testes com API interceptada são registrados como tal; não contam como validação da integração real.

Uma tela só entra como **concluída** quando o desenho nativo, as interações, o contrato real e os estados previstos do lote foram verificados. Se apenas uma parte passou, registrar a parte que passou. Revisão visual e testes ocorrem em todas as etapas; a etapa 7 verifica o conjunto e regressões.

### Lotes sugeridos dentro dos marcos

| Etapa | Ordem dos lotes | Resultado que pode ser experimentado |
| --- | --- | --- |
| 1 — Base e pedido | 1.1 componentes/tema; 1.2 detalhe/API; 1.3 contatos/entrada pela fila | Abrir um pedido autorizado e conferir cliente, catálogo e valores reais. Código inicial já existe; validação visual final/Android continua necessária |
| 2 — Conta e sessão | 2.1 entrada/cadastro/recuperação; 2.2 vínculos/convites; 2.3 permissões/contexto de sessão; 2.4 perfil/moto/documentos/configurações | Entrar, vincular, escolher loja e recuperar sessão. Dados e preferências persistem; troca de loja respeita a operação |
| 3 — Turno e rota | 3.1 home/online/tracking; 3.2 oferta/ordem/coleta; 3.3 mapas/navegação; 3.4 retorno/transferência/cancelamento/conflito | Loja acompanha desde online; motoboy recebe, aceita, coleta e percorre rota, usa Só mapa e resolve mudanças da fila |
| 4 — Finalização | 4.1 código/contrato transacional; 4.2 dinheiro/Pix/cartão/divisão; 4.3 prova/arraste/recibo; 4.4 falha de rede/reenvio | Código e recebimento conferidos; entrega e cobrança registradas no arraste; duplicidade não afeta a próxima parada |
| 5 — Comunicação | 5.1 central/texto/histórico/leitura; 5.2 contatos e chat entre colegas; 5.3 áudio/imagens/anexos; 5.4 respostas/reações/busca/fila; 5.5 grupo/notificações/admin | Cliente, loja, colegas e grupo funcionam nos canais autorizados, com mídia e recuperação de falhas |
| 6 — Trabalho e recuperação | 6.1 histórico/recibo; 6.2 ganhos/acerto/resumo; 6.3 suporte/segurança; 6.4 revisar os estados de recuperação ligados aos demais lotes | Valores reais, fechamento conferível e caminhos completos de ajuda e recuperação |
| 7 — Revisão do conjunto | 7.1 auditoria das 61 telas; 7.2 jornadas entre app/API/admin; 7.3 Android/segundo plano/permissões/desempenho/acessibilidade | Inventário completo, fidelidade visual, integrações e comportamento no aparelho comprovados |

### Publicação depois da implementação

Preparar uma versão de teste com API/banco isolados e APK instalável durante o trabalho. Quando os marcos estiverem concluídos, preparar migrations, compatibilidade do backend/admin, configuração de serviços, build e roteiro de retorno. Validar a versão candidata com dados de teste. Só então executar a publicação autorizada dos ambientes escolhidos, com verificação após atualização. O pedido atual de organizar etapas não realiza publicação.

Não estimar dias ou percentual global só pelo número de telas: cobrança, tracking em segundo plano e mídia têm complexidade maior que telas de perfil. Ao terminar cada lote, registrar esforço real e revisar a estimativa do restante. O progresso é medido por jornadas verificadas, APIs e testes concluídos.

## Regras para qualquer motor executar

- Não substituir telas aprovadas por páginas genéricas com listas de botões. Estados de erro também têm composição própria.
- Não usar WebView com o HTML para fingir implementação nativa.
- Endpoint existente é a primeira opção. Não remover validações de permissão para reaproveitar uma API administrativa no app.
- IDs de motoboy e estabelecimento vêm do token; pedido/recibo/mídia são revalidados no servidor. Não aceitar troca de identidade pelo corpo.
- A fila é autoritativa no servidor. Tratar versões, cancelamento, oferta vencida e sessão encerrada em outro aparelho.
- Preservar requisitos de pagamento/código mesmo offline. Confirmar código localmente é insuficiente. Proteger a última ação com `pedidoId`, versão e chave idempotente.
- Plano é integral. Se a sessão acabar antes de concluir, atualizar CONTINUIDADE com estado real e próximos arquivos; não declarar tela/API finalizada sem validação.
- As migrations serão arquivos versionados com verificação/rollback. Não iniciar a API apontando a produção para aplicar migrações durante a revisão.

## Estado de execução

- [x] Pesquisa, fluxos, inventário e protótipo de 61 telas.
- [x] Revisão do escuro e ampliação dos detalhes com fotos do catálogo.
- [x] Guia de modelos Claude com preços/fontes e rotina econômica.
- [x] Commit das mudanças anteriores, isolado dos documentos.
- [x] Paleta azul aplicada nas 61 telas e nos componentes nativos novos; capacete atualizado.
- [x] Código inicial da etapa 1: tema, Manrope, componentes nativos, pedido detalhado com fotos reais e consulta operacional restrita.
- [ ] Validação da etapa 1 com app/API reais em ambiente de teste e revisão Android. A revisão Expo Web com API interceptada e testes backend já passou.
- [ ] Etapas 2–7 permanecem em execução/pendência; o app completo ainda não foi entregue. Antecipados: chat básico de texto (loja/cliente/grupo), modos de câmera/visualização do mapa e proteção do ID na chegada. Isso não conclui as etapas 3 e 5.

Verificação deste lote: TypeScript sem erros; 48 testes backend selecionados passaram; Expo Web em 390 px com nove verificações de pedido/chat e todas as chamadas de API interceptadas. Foram conferidos envio de texto, preservação do rascunho após falha e parâmetros da URL. Não foram enviados pedidos, mensagens ou pagamentos reais. GPS, câmera e notificações ainda precisam de teste Android em aparelho.

Use `GUIA-MOTORES-CLAUDE.md` para escolher o motor por etapa. A economia vem de escopo preciso, reutilização e testes relevantes, mantendo os requisitos do projeto.
