# Validação do lote 2.2 — vínculos e convites

Data: 07/10/2026. Seis grupos de cenários passaram, sem erros JavaScript. TypeScript, exportação estática Expo Web e `git diff --check` passaram. Os seis grupos do lote 2.1 passaram novamente na regressão. API/banco reais e Android não validados.

## Reproduzir

Na raiz, executar `node node_modules/expo/bin/cli export --platform web --output-dir docs/validacao-etapa2/bundle` e iniciar `node docs/validacao-etapa2/servir.cjs`. Em outro terminal, rodar `node docs/validacao-etapa2/lote2/revisar.cjs`.

Usa Chrome instalado e Playwright da validação da etapa 1. APIs são totalmente interceptadas e solicitações externas bloqueadas. Todos os nomes, IDs, tokens e respostas do roteiro são fictícios. O servidor é local em `127.0.0.1:8192`; não há publicação.

## Cenários

- Quatro telas em claro/escuro, 390/320 px, movimento reduzido e texto ampliado.
- Seleção local sem POST, confirmação única, retorno com token/loja corretos e bloqueio com contexto operacional.
- Busca por cidade sem acentos, filtro DELIVERY, vazio, criação e estados de solicitação.
- Aprovação sem vínculo ativo não habilita seleção.
- Aceite após resposta, recusa com confirmação/cancelamento e bloqueio durante envio.
- Falhas/retry, convite respondido/ausente e resposta de seleção com ID incorreto.
- Resposta atrasada após sair do convite.

## Limites

API interceptada não comprova integração real nem concorrência no servidor. Texto ampliado em CSS não equivale à fonte do sistema Android. O bloqueio de troca utiliza contexto operacional local e não garante controle em outro aparelho. Comparação visual não substitui revisão nativa de toque, teclado e acessibilidade.

## Evidências

Somente as capturas listadas em Evidências são versionadas. Variações adicionais permanecem locais e podem ser regeneradas.

- [Vínculos claros](stores-claro-390.png) / [escuros em 320 px](stores-escuro-320.png) / [texto ampliado](stores-texto-ampliado-320.png).
- [Busca clara](link-claro-390.png) / [escura](link-escuro-390.png).
- [Solicitação pendente](solicitacao-pendente.png), [recusada](solicitacao-recusada.png) e [aprovada](solicitacao-aprovada.png).
- [Convite claro](invite-claro-390.png) / [escuro em 320 px](invite-escuro-320.png), [aceito](convite-aceito.png) e [recusado](convite-recusado.png).
- [Troca bloqueada](troca-bloqueada.png), [falha da lista](lista-erro.png) e [sem vínculos](sem-vinculos.png).
- `resultado.json`: `completed: true`, seis grupos, requisições interceptadas e lista vazia de erros.
