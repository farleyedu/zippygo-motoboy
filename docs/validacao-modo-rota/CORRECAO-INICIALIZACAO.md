# Correção da preparação da rota — 09/10/2026

O print “Preparando o GPS e a navegação” revelou um erro da implementação: o componente esperava `setOnLocationChanged`, mas registrar esse callback JavaScript não inicia as atualizações nativas. Faltava `startUpdatingLocation()` depois de `init()`. O ponto azul do mapa é independente desse listener.

Corrigido em `components/SdkMapa.tsx`: iniciar atualizações depois da inicialização bem-sucedida, aceitar também GPS bruto como sinal inicial, e desregistrar/parar atualizações no descarte. Mantida validação do SDK no cálculo; receber GPS bruto não é confirmação de cálculo nem de guidance.

Corrigido em `src/delivery/NativeNavigationProvider.tsx`: objeto de termos constante. O wrapper memoiza o controller pela referência desse objeto; recriá-lo em renderizações operacionais trocava o controller e disparava novamente os efeitos de descarte/inicialização. Não depende de mudar o timeout da API nem da paleta/layout.

## Validação e bloqueio restante

- TypeScript passou. Dez testes passam: oito do coordenador e dois de integração React com o SDK mockado. Os dois novos verificam o início do GPS antes do cálculo, bootstrap por GPS bruto, preservação entre atualização de props, descarte e identidade estável dos termos. Falha de cálculo não inicia guidance.
- Após Fast Refresh e tentativa explícita no emulador, a preparação foi desbloqueada. Porém, o **SDK nativo retornou `NETWORK_ERROR`** em `setDestinations`, inclusive na nova tentativa às 23:20:08 do log do Android. Portanto **a rota não está funcionando no aparelho**; não declarar concluída.
- Falhas agora têm log apenas do status do SDK e mensagem específica para rede, GPS, quota e ausência de percurso. Nenhum token, chave ou endereço é impresso por esse log.
- DNS e ping do Android para Google e maps.googleapis.com responderam. Sem proxy global configurado; permissão INTERNET presente; Android reporta rede validada. Isso não comprova acesso ao serviço de rotas.
- Diagnóstico temporário **dentro do próprio app**, via HEAD sem credenciais a `https://clients4.google.com/generate_204`, respondeu HTTP 204 às 23:23:18.648. A chamada diagnóstica foi removida após coleta. Há conexão HTTPS pública funcional no app; isso não comprova acesso ao endpoint interno autenticado do Navigation SDK.
- No computador, HTTPS público dos mesmos serviços também respondeu. Tentativas alternativas de probe TLS por pipe ADB não produziram evidência confiável e não foram usadas para diagnosticar certificados. Inspector Metro recusou conexão com 401; não foi contornado.
- Google confirma cobertura de duas rodas no Brasil. Não foi trocado silenciosamente para carro nem inventada uma polilinha.

O erro confirma falha da consulta nativa de navegação, mas **não identifica sozinho** chave inválida, SDK desabilitado, faturamento, restrição do projeto, bloqueio de rede específico ou indisponibilidade do serviço. A inicialização retornou OK e não NOT_AUTHORIZED; não é correto concluir automaticamente que a chave está errada. Não há acesso autenticado ao Google Cloud nesta sessão.

Próximo passo: conferir o Navigation SDK habilitado, permissões da chave Android, projeto/faturamento e métricas de requisições no Google Cloud no horário dessas falhas. Usuário respondeu que não conhece essa configuração; portanto a habilitação não está confirmada. A chave Android já está configurada em `app.config.ts`; não foi exposta nem substituída. Não é uma solicitação de nova autorização para editar o app; falta informação do ambiente externo.

Fontes: [listener e atualizações do SDK React Native](https://github.com/googlemaps/react-native-navigation-sdk), [significado dos status](https://developers.google.com/maps/documentation/navigation/android-sdk/reference/com/google/android/libraries/navigation/Navigator.RouteStatus), [cobertura](https://developers.google.com/maps/documentation/navigation/android-sdk/coverage-nav-sdk), [configuração do serviço Google Cloud](https://developers.google.com/maps/documentation/navigation/android-sdk/get-api-key).

## Atualização: credenciais conferidas pelo usuário e logs detalhados

Prints do Google Cloud confirmam Navigation SDK habilitado e incluído nas APIs permitidas; restrição de aplicativo marcada como Nenhum. Usuário confirmou mesma chave. Comparação automatizada, sem imprimir seu valor, confirmou também a chave no **APK instalado**, no manifest nativo e em app.config.ts. Permissão INTERNET presente no APK. Não recomendar novamente habilitação do SDK como causa comprovada.

Teste temporário no emulador com perfil DRIVING também retornou NETWORK_ERROR. Diagnóstico removido; o produto mantém TWO_WHEELER. Não houve atualização de pacote, rebuild, alteração de chave ou reinício forçado do app.

Adicionados `src/delivery/navigationDiagnostics.ts` e instrumentação de `SdkMapa.tsx`, somente em desenvolvimento. Prefixo `[Navegação][Diagnóstico]` e `attemptId` correlacionam bootstrap, reset, termos, init, versão, primeira localização bruta/ajustada, cálculo e início de guidance. Campos incluem duração e qualidade do GPS, sem lat/lng, endereço, sessão, pedido, chave ou token. Texto nativo passa por redação; não é captura dos pacotes privados do Google. Callbacks de GPS não imprimem cada amostra.

Ao falhar por NETWORK_ERROR, duas consultas HEAD públicas sem credenciais verificam HTTPS. Limitadas a um grupo em voo e intervalo de 30 segundos; timeout 8 segundos. Elas **não verificam autorização da navegação**. Resposta 400 de maps.googleapis.com sem parâmetros/chave é resposta HTTP recebida, não evidência de autorização ou de falha do roteador.

Coleta real às **20:42 de 09/10/2026, Brasília** (timestamps técnicos do Android em UTC): init OK em 377 ms; Navigation SDK nativo 7.6.1; GPS bruto válido, precisão informada 5 m; um destino com coordenadas válidas; TWO_WHEELER; cálculo retornou NETWORK_ERROR em 2215 ms. Probes: clients4.google.com HTTP 204 em 2206 ms, maps.googleapis.com HTTP 400 em 2147 ms. Ainda não revela o motivo interno do erro nativo. Logs do Render enviados pelo usuário mostram chat HTTP 200 em 384 ms e heartbeat HTTP 200 em 392 ms; são outras operações, não o cálculo do Google.

Próximo passo de investigação deve correlacionar esses eventos nativos com a chamada de rotas; não mexer em timeouts do backend nem trocar a chave com base apenas nesse status. Testes de redação/limite dos probes em `diagnostics-tests.cjs`, integração React em `sdk-bootstrap-tests.cjs` e coordenador em `navigation-tests.cjs`.

### Tentativa enviada pelo usuário às 20:45, Brasília

`nav-mv1m5rrs-p7tc`: SDK init OK em 93 ms; GPS bruto com idade 77 ms e precisão 5 m; GPS ajustado com idade 72 ms e precisão informada 3,45 m; último callback apenas 10 ms antes do cálculo. Um destino numericamente válido; NETWORK_ERROR em 672 ms. Não há evidência de falta de fix GPS nem timeout configurado de 20 segundos nessa tentativa. Validação numérica do destino não comprova endereço geocodificado correto; não foi exposta posição em logs.

Revisão do código nativo confirma enum de moto compatível (3), parsing das coordenadas lat/lng e encaminhamento do RouteStatus real. SDK não propaga motivo HTTP/exception interno por essa interface. Nada encontrado justifica atribuir o erro à conversão de status nem trocar o perfil/timeout.

Android não indicou DNS privado configurado nem bloqueio global por economia de dados na inspeção. Esses dados não verificam todo tráfego interno do SDK. Release notes consultadas: versão 7.6.1 é de maio de 2026; não foi encontrada nessa investigação evidência de correção posterior que justifique atualização automática para resolver esse status específico. Não confundir mudança de NETWORK_ERROR na inicialização da versão 8 com o erro de cálculo deste caso.

Comparativo temporário no Google Maps instalado no mesmo emulador abriu aviso inicial “Welcome to Google Maps Navigation”, incluindo link para termos e botão “Got it”. O teste não chegou a calcular rota, portanto não permite concluir que Google Maps funciona ou falha nesse ambiente. Nenhum termo foi confirmado; nosso app foi trazido novamente à frente, sem apagar dados/encerrar sessão. Pergunta de autorização enviada para confirmar esse aviso e concluir a comparação. A confirmação pertence ao Google Maps, não é uma nova aprovação de edição de código. Investigação pode continuar no mesmo emulador; aparelho físico não é pré-requisito.

```powershell
node --test docs/validacao-modo-rota/sdk-bootstrap-tests.cjs docs/validacao-modo-rota/navigation-tests.cjs
npx tsc --noEmit
```
