# Etapa 2 — conta e sessão

Data: 07/10/2026. Farley aprovou explicitamente iniciar pelo lote 2.1. Escopo: visual nativo e contratos existentes, sem editar backend/admin, fazer commit, push ou publicar.

## Lote 2.1 — entrada e cadastro

- `app/(auth)/welcome.tsx`: boas-vindas com capacete existente, identidade azul, entrada/cadastro e restauração da sessão quando a tela está visível.
- `app/(auth)/login.tsx`: visual aprovado, campos protegidos, erros locais/servidor, carregamento e bloqueio de novo envio; mantém os destinos de login conforme vínculos.
- `app/(auth)/register.tsx`: cadastro com validação por campo, confirmação de senha, falhas e confirmação somente após resposta da API. Nome/e-mail normalizados, telefone opcional e senha de 6–100 caracteres conforme contrato existente.
- `app/(auth)/recovery.tsx`: composição de recuperação com indisponibilidade explícita e envio desabilitado. Não coleta e-mail nem simula instruções; volta ao login preservando o formulário anterior.
- `src/ui/AuthKit.tsx`: composição compartilhada com teclado, entrada suave, tipografia e ações acessíveis; usa o Kit e tema da etapa 1.
- `app/(auth)/_layout.tsx` e `app/index.tsx`: novas rotas e entrada inicial por boas-vindas quando não há usuário.

Claro/escuro e movimento reduzido reutilizam preferências persistidas. Dados demonstrativos ficam somente no roteiro de revisão em `docs/validacao-etapa2/`; não estão nas telas.

## Contratos reutilizados

- `POST /api/auth/login`: `AuthContext.signIn`, armazenamento e destinos existentes.
- `POST /api/motoboys/cadastro`: `registerMotoboy`; telefone opcional, senha mínima de 6 caracteres. DTO e controller foram inspecionados somente para leitura.
- `GET /api/me/estabelecimentos`, `POST /api/auth/definir-estabelecimento` e `POST /api/auth/refresh`: seleção/restauração/refresh existentes, sem modificar os serviços.

## Diferenças necessárias em relação à demonstração

- Login informa que o acesso fica salvo; não oferece checkbox sem efeito para lembrar acesso.
- Cadastro preserva confirmação de senha, telefone opcional e mínimo de 6 caracteres do contrato existente, em vez do mínimo demonstrativo de 8.
- Não há checkbox de aceite sem termos/política reais publicados. Definir e vincular os documentos jurídicos continua pendente.
- Recuperação não apresenta formulário de envio funcional, porque nenhum contrato de solicitação/redefinição foi encontrado neste checkout.
- Cadastro concluído leva ao login existente; onboarding/permissões pertence ao lote 2.3.

## Validações

TypeScript (`tsc --noEmit`) e `git diff --check` passaram. Exportação estática Expo Web concluída com as quatro novas rotas. Seis grupos de cenários passaram em Chrome com API totalmente interceptada e solicitações externas bloqueadas, sem erros JavaScript de página: navegação/validação, falhas e retry de login, cadastro, visual/responsividade, seleção/restauração e refresh após 401.

Capturas foram inspecionadas nos temas claro/escuro, em 390/320 px e com texto 30% maior no cadastro. A revisão final usou a exportação estática local, aguardando montagem/fontes antes de interagir; o roteiro considera apenas campos visíveis porque o navegador pode manter telas anteriores na pilha. Evidências e roteiro: [validação do lote 2.1](../validacao-etapa2/README.md).

## Continuidade

Os lotes 2.1 e 2.2 não concluem toda a etapa 2. Próximos lotes: 2.3 permissões/contexto de sessão; 2.4 perfil/moto/documentos/configurações. Recuperação completa depende de contrato futuro, registrado em PENDENCIAS-BACKEND.md. Integração com API/banco reais e teclado/acessibilidade Android precisam de validação separada.

## Lote 2.2 — vínculos e convites

Farley aprovou o escopo após inspeção somente para leitura. Telas canônicas: `stores`, `link`, `link-status` e `invite`. Backend/admin, commit, push e publicação permanecem fora do escopo.

### Arquivos e comportamento

- `app/selecionarRestaurante.tsx`: capa da loja, vínculos ativos, seleção local, confirmação no rodapé, convites reais e acesso às solicitações. Tocar na loja não muda os tokens; Trabalhar nesta loja confirma pela API.
- `app/solicitarRestaurante.tsx`: busca local por nome/cidade/UF, sem exigir acentos; estados vinculado, convite, solicitação pendente, recusada e ausência de resultados. Somente lojas com módulo DELIVERY.
- `app/solicitacoesVinculo.tsx`: lista ou detalhe por ID, estados pendente/recusado/aprovado e motivo real quando disponível. Status aprovado sem vínculo ativo não libera seleção.
- `app/convite/[id].tsx`: leitura de convite autorizado, aceite, confirmação/cancelamento da recusa, sucesso após servidor e estados já respondido/ausente.
- `src/hooks/useEstablishmentLinks.ts`: consulta ao focar/retornar, erros/retry, bloqueio de ação simultânea e descarte de respostas de outra tela/identidade/convite.
- `src/ui/EstablishmentKit.tsx`: cartões de estabelecimento e status no tema compartilhado.
- `src/contexts/AuthContext.tsx`: preserva alterações anteriores e acrescenta proteção de seleção simultânea, de resposta após mudança de sessão e de ID/token retornados pelo servidor. Bloqueia troca quando há token/sessão/rastreamento operacional local, sem apagar esses dados.
- `app/_layout.tsx`: registra solicitações e convite sem cabeçalho legado.

### Contratos

Reutilizados: `GET /api/me/estabelecimentos`, `POST /api/auth/definir-estabelecimento`, `GET /api/motoboys/me/estabelecimentos-disponiveis`, `GET /api/motoboys/me/vinculos/solicitacoes`, `POST /api/motoboys/me/vinculos/solicitar` e `POST /api/motoboys/me/vinculos/convites/{id}/aceitar|recusar`. Nenhum endpoint novo nem alteração em `mobileApi.ts`.

### Limites

- Atualização de status ocorre ao entrar/retornar ou por ação Atualizar; não promete push nem implementa escuta de eventos.
- Endereço/bairro, imagem/logotipo, avisos de convite e outros dados não disponíveis não são inventados. Busca usa apenas nome/cidade/UF retornados.
- O bloqueio de troca é conservador: dados operacionais locais remanescentes também bloqueiam e pedem encerrar/recuperar o turno. Não transforma falha de consulta ou token expirado em autorização para trocar.
- O endpoint de seleção valida usuário/vínculo/loja, mas não verifica sessão/fila ativa nesta inspeção. O bloqueio do app não substitui controle transacional no servidor, nem comprova ausência de operação em outro aparelho. Essa pendência permanece no backend.
- Expiração/reconciliação completa e logout operacional serão tratados no lote 2.3; validação Android/API real permanece necessária.

### Validação do lote 2.2

TypeScript, `git diff --check` e exportação estática Expo Web passaram. Seis grupos de cenários do lote 2.2 passaram com API interceptada, sem erros JavaScript: visual/responsividade, seleção/bloqueio, busca/solicitação/status, aceite/recusa, falhas/retry e resposta atrasada. Os seis grupos do lote 2.1 também passaram novamente após as alterações no AuthContext.

Capturas dos quatro percursos foram inspecionadas em claro/escuro, 390/320 px e com texto 30% maior na seleção. Evidências: [validação do lote 2.2](../validacao-etapa2/lote2/README.md). Não equivale a integração com API/banco reais ou Android. A primeira exportação reconstruiu um cache Metro inválido; a exportação final com os últimos ajustes passou.
