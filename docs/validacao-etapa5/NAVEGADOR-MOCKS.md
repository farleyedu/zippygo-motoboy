# Teste no navegador: recursos nativos mockados

Escopo aprovado em 08/10/2026, antes da etapa 6. Somente no Expo Web de desenvolvimento; Android/iOS preservam permissoes e hardware reais. Sem commit, publicacao ou mudanca de banco.

## Ativacao e sinalizacao

- Ativo por padrao quando `Platform.OS === 'web'`, `__DEV__` e `EXPO_PUBLIC_APP_ENV` e `dev`/`development` (padrao local: `dev`). Build de producao nao ativa mocks.
- `EXPO_PUBLIC_BROWSER_MOCKS=false` desliga; reiniciar Metro depois de mudar variaveis Expo.
- Faixa permanente `MOCK · TESTE NO NAVEGADOR · API REAL`, fora da area de conteudo, com a ultima acao simulada. A faixa nao aparece no Android/iOS nem em producao.
- IMPORTANTE: nao e um backend ficticio. Login, fila, aceite, pagamentos, conclusoes sem dados mock e texto do chat continuam usando a API configurada. Para testar sem efeitos reais, apontar para API de teste ou usar os scripts com API interceptada.

## Comportamento

| Recurso | Navegador de desenvolvimento |
| --- | --- |
| Permissoes/GPS/segundo plano | Verificacoes liberadas, sem solicitar permissao. Monitor confirma simulacao local; nenhum GPS capturado, enfileirado ou enviado. |
| Mapa | Marcador de GPS mock proximo ao primeiro destino, ou ponto demonstrativo quando nao ha destinos. Tooltip identifica o mock; nao indica posicao real. |
| Camera | Gera JPEG com `FOTO MOCK`, `Teste no navegador` e `Nao comprova uma entrega real`. Nao acessa webcam. |
| Comprovante | Foto mock anexa na sessao local do navegador, com ID `browser-mock-proof:`. Nunca faz upload; conclusao real com esse ID e bloqueada antes de mudar o rascunho para envio pendente. |
| Avatar/documentos | Foto mock nao pode ser enviada ao cadastro. Mensagem informa bloqueio e caminho para escolher arquivo real. |
| Escolha de arquivo | Permanece real, pelo seletor do navegador. Arquivo escolhido manualmente pode ser enviado a API; nao e rotulado como foto mock. |
| Audio | Gravacao com contador simulado, previa com audio de exemplo e envio somente local, sem microfone, arquivo na outbox ou HTTP. Disponivel tambem no chat do cliente. |
| Push | Nenhum token real ou pedido nativo. Sino da faixa simula aviso local e identifica que nenhum push foi enviado. Nao comprova entrega Expo. |
| Maps/Waze, discador, vibracao | Acao identificada como mock, sem abrir aplicativo, iniciar chamada ou vibrar fisicamente. |

Nao simular confirmacao real de entrega/pagamento ou transformar foto ficticia em prova de entrega. Para percorrer a finalizacao inteira, usar API/fixtures de teste e foto real escolhida manualmente, ou testes automatizados isolados.

## Arquivos

`services/browserNativeTest.ts`, `operationalPermissions.ts`, `trackingService.ts`, `accountImage.ts`, `accountApi.ts`, `completionApi.ts`, `navigation.ts`; `components/locationSetup.ts`, `Mapa.web.tsx`; `app/_layout.tsx`, `permissoes.tsx`, `permissaoNegada.tsx`, `somVibracao.tsx`, `chegadaEntrega.tsx`, `pedido/[id].tsx`; `src/ui/BrowserTestBanner.tsx`, `DeliveryProofScreen.tsx`; `src/chat/BrowserAudioComposer.tsx`, `ChatMedia.tsx`, `ClientConversation.tsx`, `push.ts`; `src/contexts/DeliveryCompletionContext.tsx`.

## Validacao

- `browser-native-domain.cjs`: 11 cenarios, incluindo isolamento de desenvolvimento/Android/producao, permissoes, GPS, camera, cadastro, comprovante local, bloqueio de conclusao e chamadas externas.
- `browser-native-ui.cjs`: permissoes, aviso, audio e camera em 320 px claro e 390 px escuro; seis capturas. Testes proibem acesso real a geolocalizacao e `getUserMedia`; API interceptada.
- TypeScript sem erros; testes de push nativo e dominio de chat repetidos para regressao.
- Nao comprovam execucao Android ou hardware. Nenhuma mensagem, pagamento ou operacao de producao disparada pelos testes.

Preview local: http://localhost:8198.

## Etapa 6

Nao implementada nesta rodada. Diretriz atual de remuneracao: entrega fixa ou por distancia, hora, turno/diaria, semanal/quinzenal/mensal. Sem bairro, valor fechado por rota, percentual, faixas de producao, hibrido, valor negociado ou componentes combinaveis. Loja configura; motoboy consulta. Oferta por entrega variavel deve mostrar ganho de cada pedido e soma da rota, sem criar modalidade de pagamento por rota.
