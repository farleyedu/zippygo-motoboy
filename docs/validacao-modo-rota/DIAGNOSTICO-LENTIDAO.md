# Lentidão e timeouts — diagnóstico de 09/10/2026

Escopo autorizado: analisar e explicar, depois de implementar o modo rota. Nenhuma otimização de desempenho, mudança de timeout, alteração de backend, encerramento do app ou limpeza de sessão foi aplicada nesta investigação.

## Conclusão

Existe um travamento real do app no emulador e há pressão de memória no ambiente. Os timeouts apresentados também são reais, mas não permitem determinar sozinhos se a demora ocorre no transporte, na API ou no banco. Não há evidência suficiente para atribuir tudo à máquina nem para declarar o backend como causa comprovada.

Separar duas experiências: um toque que não produz feedback pode envolver a execução da interface; um botão que mostra carregamento enquanto aguarda confirmação do servidor depende da duração da operação remota. Um `await` de rede não bloqueia, por si só, a thread de interface.

## Evidências coletadas

| Observação | Resultado | Alcance da evidência |
|---|---|---|
| RAM do computador | 15,71 GB totais; 2,00 GB livres, aproximadamente 87% ocupada | Pressão de memória; não prova que todo clique lento é causado pelo host |
| CPU do computador | 19% em uma amostra | Não comprova sobrecarga contínua de CPU |
| Processo do emulador | Aproximadamente 1,91 GB de RAM | Parte relevante do consumo, junto de VS Code, Node e Chrome |
| Memória do Android | Cerca de 2,41 GiB totais e 0,48 GiB disponíveis | Pouca folga no emulador |
| Swap do Android | Aproximadamente 1,40 GiB utilizada | Compatível com pressão de memória; não quantifica, sozinha, a intensidade de paginação |
| Carga do Android, 4 CPUs | 0,58 / 11,31 / 14,27, janela retrospectiva do dumpsys | Carga recente elevada; o valor de um minuto já era menor |
| ANR do app | Evento às 22:42:30: `No response to onStartJob` | O Android registrou falta de resposta de um callback de job |
| ANR do Google Play Services | Evento às 22:43:49: serviço aguardou 24845 ms | O problema de responsividade não estava restrito ao nosso app |
| Tela capturada | Diálogo Android “app isn't responding”, na retomada de sessão | Impediu a homologação nativa do novo modo rota |
| GET de fila sem token, pelo computador | HTTP 401 em 0,510 s; DNS 0,039 s; TLS acumulado 0,245 s | API alcançável naquele momento; não testa fila autenticada, banco nem rede do Android |

Captura e revisão visual em `C:/Users/farle/.codex/tmp/zippy-navigation-20261009/`. Os horários de ANR são os registrados no log do emulador. Não foram extraídos tokens do dispositivo nem enviados pontos GPS de teste à produção.

O Android classifica demora em `onStartJob` como uma forma de ANR; é necessário examinar as threads para distinguir bloqueio do app e efeitos de carga do sistema. Não foi obtido o trace completo desse ANR. [Documentação Android](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs).

O modo de desenvolvimento adiciona validações e trabalho que tornam o app mais lento; uma comparação em produção e em aparelho físico seria necessária para medir a experiência final. Não foi feita troca de build nesta rodada. [Documentação Expo](https://docs.expo.dev/workflow/development-mode/).

## O que os três avisos significam

- GPS em lote e fila usam timeout de 20000 ms; notificações do chat usam 10000 ms.
- Os tempos observados, 20024/20031/10033 ms, correspondem a esses limites. O adapter cancela o `fetch` quando o prazo termina, inclusive enquanto aguarda o corpo da resposta.
- `ECONNABORTED` sem status HTTP significa que o cliente não recebeu uma resposta completa a tempo. Não é evidência de HTTP 401, erro de permissão ou HTTP 500.
- “Sincronização aguarda conexão” é a mensagem usada para falhas transitórias; não comprova, literalmente, que a internet caiu.
- Os timers dispararam perto do limite nesses exemplos. Não há evidência de que a thread JavaScript tenha ficado parada durante os mesmos 20 segundos.

## Revisão do processo existente

**Já existem proteções úteis:** envio GPS em lotes de até 20 amostras, confirmação por identificação da amostra, retenção do que não foi confirmado, backoff de 15/30/60 segundos; fila operacional compartilha requisição pendente; notificações têm trava `inFlight` e só consultam com app ativo. Não é correto afirmar que essas três rotinas simplesmente disparam requisições duplicadas sem controle.

**Pontos a medir antes de otimizar:**

1. `services/trackingService.ts`: persistência e envio são serializados; uma tentativa de rede de 20 segundos pode atrasar o trabalho seguinte dessa fila. Isso não equivale a bloqueio síncrono da interface.
2. `components/locationTask.ts`: o callback de localização aguarda presença e envio de GPS em paralelo. Pode permanecer pendente enquanto a rede demora. Não está demonstrado que essa espera assíncrona seja a causa do ANR `onStartJob`.
3. `src/chat/ChatNotices.tsx` e `src/chat/push.ts`: há tentativa periódica de registro push a cada 15 segundos, com obtenção do token Expo e PUT de preferências. A permissão tem deduplicação, mas a função completa de registro não tem trava própria nem comparação das preferências já registradas. É um candidato para reduzir trabalho repetido; não foi alterado.
4. `src/hooks/useRouteAction.ts`: ações operacionais aguardam confirmação antes de navegar. A demora da API prolonga o loading; mudar isso exige preservar consistência da entrega.
5. Backend: autenticação operacional consulta o banco antes do controller. GPS em lote usa transação e bloqueio da sessão; fila monta snapshot transacional. Espera por conexão, bloqueio e consultas devem ser medidos, não presumidos.
6. Notificações: serviço autoriza o acesso e repositório consulta até 100 mensagens não lidas, depois enriquece os resultados. Esse caminho não recebe o cancelamento HTTP de ponta a ponta. É um candidato de revisão, sem alteração nesta rodada.

## Como fechar a causa em uma próxima rodada

Correlacionar o horário das falhas com os logs e métricas já existentes no backend, documentados em `motoboyBackEnd/docs/SINCRONIZACAO-DELIVERY.md`: duração total da requisição, duração do banco e espera por conexão. Logs lentos incluem operação, status, duração e traceId. Duração total inclui autenticação. Verificar também bloqueios PostgreSQL e latência das consultas reais de chat.

Para o travamento, obter o trace do ANR e um perfil do dispositivo, sem assumir que aumentar timeout resolve responsividade. Comparar a mesma ação em aparelho físico e build de produção, separando tempo de feedback do toque, tempo de requisição e tempo de renderização. [Como localizar a thread sem resposta no Android](https://developer.android.com/topic/performance/anrs/find-unresponsive-thread).

Até essa correlação, cold start do Render, pool saturado, índice faltante, bloqueio de banco ou bug específico do callback continuam hipóteses. Não foram comprovados nem corrigidos nesta rodada.
