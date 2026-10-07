# Validação da etapa 1 — 07/10/2026

Resultado: base visual e detalhes do pedido implementados no Expo. TypeScript e `git diff --check` passaram. Sete cenários de revisão web passaram, sem erros JavaScript de página, com API totalmente interceptada. Não representa integração com API/banco reais.

## Evidências

Somente as capturas listadas em Evidências são versionadas. Variações adicionais permanecem locais e podem ser regeneradas.

- [Pedido claro](pedido-claro-390.png) / [escuro](pedido-escuro-390.png).
- [Conferência clara](pedido-conferencia-claro.png) / [escura](pedido-conferencia-escuro.png).
- [320 px](pedido-escuro-320.png) / [texto 30% maior](pedido-fonte-ampliada-320.png).
- [Erro e nova tentativa](pedido-erro.png), [dados ausentes](pedido-sem-itens.png) e [central de conversas](conversas-base.png).
- `resultado.json`: cenários e requisições interceptadas, incluindo `expectedPedidoId` na chegada.
- `typescript.json`: comparação em memória com HEAD, sem novos erros nos 61 arquivos TypeScript. `tsc --noEmit` também passou após a instalação completa.

## Reproduzir

No diretório raiz, iniciar `node node_modules/expo/bin/cli start --web --port 8191`. Em outro terminal, executar `node docs/validacao-etapa1/revisar.cjs`. O script usa Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe` e Playwright instalado localmente nesta pasta (`npm.cmd install --prefix docs/validacao-etapa1 --no-save --package-lock=false playwright`).

`comparar-typescript.cjs` compara os três arquivos de produto com HEAD em memória, sem restaurar alterações.

## Limitações e ambiente

- O `npm ci` original falhou por entradas ausentes no lockfile (dependências opcionais de outras plataformas). Para esta revisão foi usado `npm.cmd install --legacy-peer-deps --no-package-lock --no-audit --no-fund`; isso resolve versões permitidas pelo manifesto e não comprova reprodutibilidade exata do lockfile.
- O Expo Router dessa instalação exigiu `query-string`; foi instalado localmente com `npm.cmd install --no-save --legacy-peer-deps --package-lock=false query-string@7.1.3`. `package.json` e `package-lock.json` não foram alterados. Regularizar a instalação reproduzível fica como pendência de ambiente, separada do visual.
- A primeira compilação web excedeu o timeout de navegação; o bundle foi concluído e a revisão foi repetida com sucesso.
- `Field` é um componente base tipado para as próximas telas; teclado/permissões do sistema e comportamento nativo ainda precisam de teste em aparelho.
- Texto ampliado foi simulado em CSS no navegador; não equivale à configuração de fonte/acessibilidade do Android.
- A finalização existente exige login: esta revisão verifica envio do ID e encaminhamento; não confirma entrega/código/pagamento reais.
- Nenhuma mensagem, pagamento, publicação ou alteração de backend/painel foi realizada.
