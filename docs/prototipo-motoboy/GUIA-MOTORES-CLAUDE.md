# Guia de Claude para executar o ZippyGo com economia

Consulta às fontes oficiais em **07/10/2026**. Recomendação para este projeto: **Sonnet como padrão**, Haiku para mudanças pequenas com instruções fechadas e Opus para decisões difíceis ou revisão das regras críticas. Essa divisão é minha avaliação do trabalho do ZippyGo. Evita gastar o modelo mais caro em todas as telas.

## Qual modelo usar aqui

| Parte do projeto | Modelo inicial | Esforço sugerido | Quando subir |
| --- | --- | --- | --- |
| Textos, espaçamento, cores e ícones em componentes prontos | Haiku | Baixo, se disponível | Se exigir reorganizar navegação ou comportamento |
| Repetir um padrão de tela já aprovado | Haiku, com lista de arquivos e contrato | Baixo | Se faltar informação sobre estados ou integrações |
| Construir telas nativas, animações, formulários e chat com contratos definidos | Sonnet | Padrão/médio | Se uma falha envolver vários módulos |
| Ligar APIs existentes, loading, erros e paginação | Sonnet | Padrão/médio | Se surgir dúvida de autenticação, isolamento entre lojas ou concorrência |
| Implementar endpoints previstos no plano | Sonnet | Médio | Opus para revisar transações, autorização e compatibilidade |
| Planejar pagamentos + entrega, código, idempotência, fila offline e troca de loja | Opus | Alto somente nesse bloco | Voltar a Sonnet depois de registrar decisões e testes |
| Corrigir problema conhecido com reprodução curta | Sonnet | Médio | Opus após duas tentativas sem diagnóstico novo |
| Revisar o fluxo completo antes de usar em operação | Opus | Alto | Revisão concentrada no diff e testes relevantes |
| Organizar README e atualizar continuidade com fatos já verificados | Haiku | Baixo | Sonnet se precisar investigar o que foi implementado |

A Anthropic recomenda Haiku para tarefas mecânicas, Sonnet para a maioria da programação e Opus para mudanças amplas ou problemas difíceis. A disponibilidade depende da conta e da ferramenta. Confira o seletor ou `/model`. [Orientação oficial](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code).

**Não escolheria Haiku para executar sozinho o plano inteiro.** A economia deve considerar também o retrabalho. Não reservaria o maior esforço para ajustes visuais simples.

## Preços de API para comparar

Valores publicados em dólares por **1 milhão de tokens**, sem cache, ferramentas, impostos ou preços próprios de intermediários:

| Modelo publicado na consulta | Entrada | Saída | Exemplo: 100 mil de entrada + 10 mil de saída |
| --- | ---: | ---: | ---: |
| Haiku 4.5 | US$ 1 | US$ 5 | US$ 0,15 |
| Sonnet 5.5 | US$ 2 | US$ 10 | US$ 0,30 |
| Opus 5.5 | US$ 4 | US$ 20 | US$ 0,60 |
| Fable 5.1 | US$ 10 | US$ 50 | US$ 1,50 |

Os exemplos são cálculos, não previsão do custo de implementar o app. Para essa mesma quantidade de tokens, Sonnet 5.5 custa metade de Opus 5.5. O total real depende de leituras, raciocínio, respostas, tentativas e cache. O preço publicado de Sonnet 4.6/4.5 é US$ 3 de entrada e US$ 15 de saída; se sua ferramenta só oferecer essas versões, use esse valor. [Tabela oficial de preços](https://claude.com/pricing).

Fable não seria meu padrão para este projeto visando economia. Os modelos mais caros podem valer a pena num diagnóstico difícil, mas não precisam acompanhar cada ajuste.

## Assinatura, API e IDE são contas diferentes

Na assinatura, o objetivo é preservar a franquia: tamanho da conversa, modelo, esforço e ferramentas influenciam os limites. Claude no navegador, desktop e Claude Code compartilham limites de uso da conta. A tabela de tokens acima **não converte a porcentagem da assinatura em dólares nem em número garantido de telas**. [Como funcionam os limites](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work).

Com API, a cobrança acompanha os tokens e recursos usados. Com uma IDE que vende créditos próprios, confira a tabela dessa IDE: o multiplicador pode ser diferente da API. Os percentuais semanais que você informou para esta sessão não permitem calcular o saldo de Claude.

## Rotina prática no Claude Code

1. Comece um bloco de implementação com `/model sonnet`.
2. Para um ajuste mecânico curto, use `/model haiku`.
3. Para um problema crítico, use `/model opus`, feche o diagnóstico e volte a Sonnet.
4. Se o bloco ainda precisar de planejamento complexo, `/model opusplan` planeja com Opus e executa com Sonnet. Como o plano deste app já está sendo escrito, Sonnet direto costuma ser a opção mais econômica.

Esses comandos são do Claude Code. Em outra IDE, use as opções equivalentes do seletor. Aliases podem apontar para versões diferentes conforme conta, provedor e instalação. [Configuração dos modelos e opusplan](https://code.claude.com/docs/en/model-config).

## Como reduzir o consumo sem perder o plano

- Trabalhe por jornadas: pedido, chat, localização, finalização, conta. Em cada bloco, indique arquivos, endpoints e critérios de conclusão.
- Antes de começar outra jornada, salve o resultado em `CONTINUIDADE.md`. Inicie uma conversa nova com os caminhos dos documentos necessários.
- Durante uma jornada longa, use `/compact`. Use `/clear` apenas depois de salvar o contexto necessário, pois ele apaga o histórico da conversa.
- Peça leitura seletiva: nome do arquivo e função. Evite colar repositórios, lockfiles ou logs inteiros.
- Use o esforço padrão/médio e aumente somente onde houver análise complexa. Tokens de raciocínio também entram na cobrança de saída da API.
- Evite fast mode, pesquisas repetidas e equipes de agentes para pequenos ajustes. Eles não garantem economia. Faça primeiro o teste relevante; amplie a verificação se surgir uma falha.

Essas medidas seguem a orientação de controlar contexto, esforço e escopo. [Gestão de custos](https://code.claude.com/docs/en/costs), [Gestão de sessão](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code).

## Prompt econômico para continuar

```text
Continue o ZippyGo em português. Leia AGENTS.md, docs/prototipo-motoboy/CONTINUIDADE.md
e somente a etapa pertinente de docs/prototipo-motoboy/IMPLEMENTACAO.md.

Etapa desta sessão: [nome da jornada].
Reaproveite os endpoints e fotos do catálogo existentes; crie apenas o que falta.
Preserve as modificações anteriores do usuário. O protótipo aprovado está em
docs/prototipo-motoboy/index.html, styles.css e prototype.js.

Implemente esta jornada por completo, com dados reais, erros e permissões.
Não simule sucesso de API, pagamento, código ou envio. Na finalização, o pagamento
é preparado pelo usuário e só é registrado junto da conclusão por arraste.
Código validado continua visível e desabilitado. Nenhuma próxima entrega deve ser
liberada por uma conclusão ainda pendente de confirmação do servidor.

Leia arquivos seletivamente, execute os testes pertinentes e atualize a continuidade
com arquivos alterados, validação e trabalho restante. Não faça deploy nem envie
mensagens reais a outras pessoas para testar.
```

Para OpenAI, minha divisão equivalente é **Sol para a execução, Luna para ajustes delimitados e Astra para decisões/revisões complexas**. [Orientação oficial de escolha de modelos](https://developers.openai.com/api/docs/guides/model-selection).
