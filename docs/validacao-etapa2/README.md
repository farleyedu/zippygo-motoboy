# Validação do lote 2.1 — 07/10/2026

Resultado: seis grupos de cenários passaram, sem erros JavaScript de página. TypeScript, exportação estática Expo Web e `git diff --check` passaram. Capturas foram inspecionadas em claro/escuro, 390/320 px e texto ampliado. Não representa integração com API/banco reais.

## Reproduzir

Na raiz, exportar `node node_modules/expo/bin/cli export --platform web --output-dir docs/validacao-etapa2/bundle` e iniciar `node docs/validacao-etapa2/servir.cjs`. Em outro terminal PowerShell, definir `$env:QA_BASE_URL='http://127.0.0.1:8192'` e executar `node docs/validacao-etapa2/revisar.cjs`. O bundle é gerado localmente e ignorado pelo Git; o servidor usa apenas loopback.

Alternativa: iniciar `node node_modules/expo/bin/cli start --web --port 8191` e rodar o roteiro sem `QA_BASE_URL`. A evidência final registrada aqui usou a exportação estática, sem recompilações durante a revisão.

O roteiro usa Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe` e reaproveita o Playwright local da validação anterior em `docs/validacao-etapa1/node_modules/playwright`. Não adiciona dependências ao manifesto/lockfile. Uma URL local alternativa pode ser definida por `QA_BASE_URL`.

Todas as chamadas de API são interceptadas; outras solicitações externas são bloqueadas. Dados e tokens são fictícios e exclusivos da revisão. Resultados/requisições ficam em `resultado.json`; capturas ficam nesta pasta.

## Verificações realizadas

- Entrada inicial, navegação e imagem do capacete.
- Campos inválidos sem envio; erros de credenciais/rede, nova tentativa e campos bloqueados durante envio.
- Recuperação indisponível com botão desabilitado e sem formulário de coleta/envio.
- Cadastro com confirmação diferente, conflito, telefone opcional, normalização, envio único e sucesso após resposta.
- Quatro telas em claro/escuro e 390/320 px; tema persistido; texto 30% maior no cadastro e movimento reduzido.
- Destinos após login com zero/um/dois vínculos; sessão persistida e refresh após 401.
- TypeScript, exportação Expo Web e `git diff --check`.

## Evidências

Somente as capturas listadas em Evidências são versionadas. Variações adicionais permanecem locais e podem ser regeneradas.

- [Boas-vindas claras](welcome-claro-390.png) / [escuras](welcome-escuro-390.png).
- [Login claro](login-claro-390.png) / [escuro em 320 px](login-escuro-320.png) / [erro](login-erro.png).
- [Cadastro claro](register-claro-390.png) / [escuro](register-escuro-390.png) / [sucesso](register-sucesso.png) / [texto ampliado](register-texto-ampliado-320.png).
- [Recuperação clara](recovery-claro-390.png) / [escura em 320 px](recovery-escuro-320.png).
- `resultado.json`: `completed: true`, seis grupos de cenários, requisições interceptadas e lista vazia de erros JavaScript.

## Limitações

API interceptada não comprova integração real. Teclado, autofill, tamanho de fonte do sistema e acessibilidade Android exigem aparelho. Preferências são configuradas no armazenamento pelo roteiro; a tela de configurações da etapa 2.4 ainda não foi implementada. A pendência de instalação reproduzível/lockfile da etapa 1 permanece fora deste lote.
