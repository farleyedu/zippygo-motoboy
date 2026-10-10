# Dossiê do modo rota: Google Maps, Waze e ZippyGo

**Pesquisa e auditoria: 09/10/2026. Estado: análise para decisão do Farley. Nenhuma implementação autorizada por este documento.**

## Resultado principal

**Atualização posterior à pesquisa:** o Farley autorizou a implementação do modo rota com as duas imagens de referência. Mudanças e verificações em [validação do modo rota](../validacao-modo-rota/README.md). As tabelas abaixo preservam a auditoria anterior à implementação; não são o status atualizado do código. Homologação nativa continua pendente devido ao ANR encontrado no emulador.

O ZippyGo já integra um motor real de navegação Google no código nativo. Porém, **a experiência solicitada — acompanhar o motoboy e deixar inequívoca a próxima conversão — ainda não pode ser considerada entregue**. Há integração parcial, controles desativados e uma divergência entre o estado visual da tela e o estado confirmado pelo motor. O print enviado mostra uma visão geral do mapa; não demonstra orientação curva a curva ativa.

Este documento reúne **106 itens** de interface, navegação e operação de entrega, compara cada um com o checkout principal e registra fontes e evidências. A distribuição é: 26 parcial; 17 código; 8 não comprovado; 49 ausente; 6 desativado. **Esses números não são percentual de conclusão:** os itens têm pesos diferentes, e “código” não significa uma viagem validada no aparelho.

A planilha [DECISOES-MODO-ROTA.csv](DECISOES-MODO-ROTA.csv) contém os mesmos IDs. Decisões expressas pelo Farley são registradas; os demais campos continuam pendentes. A pesquisa não autoriza implementar automaticamente todo o inventário.

## Decisões do Farley: referência visual do modo rota

Atualização de 09/10/2026, após as duas imagens de navegação enviadas no chat. Esta seção prevalece sobre sugestões anteriores do dossiê para a tela de condução. Registra requisitos; não declara implementação concluída nem autoriza outras funções do inventário.

**O objetivo durante o modo rota é entender o endereço e o caminho. Detalhes do pedido não devem ocupar a interface de condução.** Nome do cliente, foto de produto, itens, valores, checklist e botão grande de conferir ficam no fluxo operacional separado, acessível ao sair da navegação ou na chegada. Chegar não conclui a entrega automaticamente.

### Estado 1: acompanhando o motoboy — primeira imagem

- Cabeçalho persistente: seta da manobra, distância até a conversão e nome da rua; próxima manobra em uma área secundária quando aplicável.
- Mapa como superfície principal: veículo visível no eixo central horizontal, câmera seguindo posição/direção e espaço à frente para antecipar o caminho.
- Traçado destacado do percurso calculado pelas ruas, até o endereço de destino. O Farley pediu acabamento tracejado; as imagens usam linha contínua. A geometria precisa representar o caminho calculado, sem linhas retas ligando pins. A viabilidade do acabamento tracejado será verificada na integração, sem esconder a rota nativa nem desenhar um percurso divergente.
- Rodapé persistente e compacto: tempo restante, distância, horário previsto de chegada e ação de sair da navegação. Sair da navegação não encerra turno nem finaliza pedido.
- Botão de centralizar disponível para restaurar o acompanhamento; controles secundários discretos e agrupados.

### Estado 2: explorando o percurso — segunda imagem

- Arrastar, pinçar para aproximar/afastar e explorar libera a câmera, sem ser puxada de volta por cada atualização do GPS.
- Cabeçalho e rodapé permanecem visíveis. A orientação e a viagem continuam; explorar o mapa não equivale a parar guidance.
- O usuário pode entender o percurso, localização atual e destino em diferentes escalas. A imagem mostra alternativas, mas sua presença na referência não aprova automaticamente comparação de alternativas no nosso produto.
- Centralizar retorna à posição atual, direção e perspectiva de condução. A mudança entre os dois estados deve ser clara e estável.
- Não usar o gesto de explorar para esconder o cabeçalho/rodapé. A interação anterior de toque para limpar elementos precisa ser reconciliada com essa nova exigência de orientação persistente.

### Funções retiradas e funções preservadas

- **N078 — comandos por voz e relato conversacional: Não quero.** Não implementar assistente de voz/Gemini para controlar a navegação.
- **N085 — compartilhar viagem por link: Não quero.** Retirado da seleção futura.
- Orientação falada das conversões é diferente de controle por voz e não foi retirada neste pedido. Preferências adicionais de áudio continuam sujeitas à seleção do Farley.
- A localização operacional enviada à loja e a preferência existente de localização para o cliente não são o compartilhamento livre da viagem por link; esta decisão não autoriza remover esses fluxos existentes.
- Usar as duas imagens como referência de composição e comportamento, preservando a identidade visual aprovada do ZippyGo. Verde do cabeçalho, carro, assistente, folha de economia, busca, relatos e demais ícones da referência não são aprovação automática desses recursos ou de uma nova paleta.

Para a futura implementação, comprovar os dois estados em vídeo no aparelho: curva com acompanhamento, exploração com zoom, orientação persistente e retorno pelo botão Centralizar. O resultado não pode ser apenas uma tela expandida com pins.

## Como ler e limites da pesquisa

- Escopo principal: condução no celular, Android prioritário, motociclista e entregas no Brasil. iOS, projeção automotiva, recursos regionais e versões beta são diferenciados.
- Fontes: ajuda e anúncios oficiais Google/Waze e documentação oficial do Navigation SDK. Artigos comunitários não foram usados para confirmar funções.
- Google Maps **aplicativo**, Google **Navigation SDK**, wrapper **React Native** e **nosso aplicativo** são quatro camadas diferentes. Uma função no primeiro não está automaticamente disponível nas outras.
- O Waze escolhido em Configurações é o **navegador externo**. O motor dentro do app continua Google; não temos um Waze embutido.
- A pesquisa cobre o inventário público consultado, não todo experimento, combinação de país, versão ou aparelho. “NC” significa **não confirmado nesta pesquisa**, e nunca “o concorrente não tem”.
- Auditoria local: master, HEAD `7ff5bb2`, com alterações locais já presentes preservadas. Código foi lido; nenhum build, trajeto, operação real, teste nativo ou chamada autenticada de produção foi executado nesta tarefa.
- A revisão Web existente em [QA da etapa 3/4](../validacao-etapa2/etapa34/README.md) usa fixtures/API interceptada. Ela não comprova câmera, rota, voz ou faixas do SDK nativo.
- “Ausente” significa não encontrado na integração/UI auditada; o SDK pode ter recursos internos não observados. Uma capacidade implícita recebe “Não comprovado”, não aprovação.
- Análise principal feita no mobile; contratos de API usados pelo mobile são citados. Não é auditoria completa do servidor nem prova de dados disponíveis em produção.
- O plano aprovado e o protótipo HTML continuam sendo referências visuais do produto. Esta comparação não aprova trocar a paleta ou copiar o visual dos concorrentes.

### Legenda do nosso estado

| Estado | Significado |
| --- | --- |
| Código | Implementação concreta identificada; ainda sem validação nativa desta tarefa. |
| Parcial | Parte existe, mas há lacuna de UI, comportamento, integração ou continuidade. |
| Desativado | Controle explicitamente desligado no NavigationView e sem substituto encontrado. |
| Ausente | Função/controle equivalente não encontrado no escopo auditado. |
| Não comprovado | Motor pode fornecer; não há evidência suficiente da integração e resultado no aparelho. |

## A experiência de navegação, do início à chegada

### Google Maps: estrutura e propósito

Antes de iniciar, o usuário define destino, modo de transporte, percurso e paradas. A prévia serve para decidir; a condução serve para orientar. Alternativas, sequência e horário de partida pertencem à preparação. [G2]

Durante a condução, orientação visual e voz indicam conversões e faixas quando os dados estão disponíveis; o percurso e a posição precisam responder à localização. Há acesso a busca no caminho, opções e incidentes. [G1]

**Leitura do print do Google Maps enviado pelo Farley**, não especificação universal: manobra ocupa o topo; o veículo fica no eixo central horizontal e abaixo do centro vertical; sobra estrada à frente; o trajeto tem forte contraste; duração, distância e horário de chegada ficam em uma faixa inferior compacta; ações secundárias ficam agrupadas na lateral. A seta não precisa ficar no centro geométrico exato para cumprir “estar centralizado na câmera”: o requisito é permanecer visível e ter espaço de antecipação.

O novo Immersive Navigation foi anunciado em março de 2026, inicialmente nos EUA. Adiciona detalhes espaciais, zoom inteligente, instruções mais naturais e orientação na aproximação ao destino. A disponibilidade brasileira dessas novidades não foi comprovada. Não confundir essa atualização com navegação inclinada comum, nem presumir acesso via SDK. [G7]

### Waze: estrutura e propósito

Na preparação há alternativas e preferências do veículo. Durante a viagem, o usuário pode abrir outras rotas; sugestões permitem mudar ou manter o caminho. A área de ETA também dá acesso a ações da viagem, como acrescentar parada e compartilhar. A documentação limita o Waze a **uma parada intermediária por rota**, enquanto Maps admite até nove destinos incluindo o final. [W1] [W9] [W15] [G2]

A diferenciação funcional do Waze é a participação da comunidade: incidentes, perigos e atualização do mapa; avisos específicos das características da via; preferências de condução e áudio. Relatos, alerta visual e alerta sonoro são funções distintas. [W8] [W7] [W4]

O anúncio oficial de **13/07/2026** inclui Brasil no lançamento das melhorias do modo motocicleta. Também distingue relato conversacional, personalização de rotas e busca com Gemini em beta. “Anunciado/implantação gradual” não significa “disponível no aparelho do Farley” nem “disponível no nosso motor Google”. [W23]

**Leitura de interface baseada na documentação e materiais oficiais**, sem teste físico próprio do Waze: o núcleo deve dar prioridade a instrução, percurso/veículo e ETA; relatar e trocar rota são ações secundárias acessíveis; preferências detalhadas ficam fora da superfície principal. A posição exata dos controles de câmera e o comportamento por versão ainda requerem captura do Waze no aparelho. Não inventei medidas, offsets ou uma política de zoom como se tivessem sido aferidos.

### O que essa comparação implica para o nosso layout

Estas são recomendações para escolha, não mudanças aprovadas:

| Região / estado | Informação principal | Problema atual / decisão |
| --- | --- | --- |
| Prévia | Percurso, destinos numerados, próxima parada e iniciar | Não anunciar seguimento antes de autorização, GPS, cálculo e início confirmados. |
| Topo em condução | Seta + metros + rua; segunda manobra quando relevante | Header do SDK existe, mas não aparece no print. Distinguir falha técnica de desenho da UI. |
| Centro | Motoboy e caminho à frente | Reservar câmera considerando header/sheet e orientação; validar espaço em telas pequenas. |
| Lateral | Retomar seguimento, som e menu | Agrupar opções; evitar uma fileira de botões grandes atravessando o mapa. |
| Rodapé em condução | Tempo, distância, chegada e pedido em uma linha compacta | Sheet hoje destaca destinatário e conferência, mas ocupa área útil demais para dirigir. |
| Mapa livre | Explorar e botão explícito para voltar a acompanhar | Navegação/voz podem continuar sem prender o gesto; não confundir explorar com parar orientação. |
| Mapa limpo | Caminho, motoboy e orientação mínima | Ocultar opções secundárias não deveria tirar a informação de onde virar. Escolha final do Farley. |
| Aproximação / chegada | Pedido #, volumes/extras e acesso à conferência | Exibir tarefa relevante ao parar; chegada GPS não confirma entrega nem pagamento. |
| Falha | GPS/SDK/rede indisponível e recuperação clara | Não manter aparência “em navegação” quando só há um mapa geral. |

O fluxo proposto para avaliar é:
**prévia → preparando → orientação confirmada → exploração opcional / retomar → recalculando quando necessário → chegada → conferência operacional → próximo pedido ou retorno à loja**.
A condução não deve depender de o motoboy apertar “Conferir pedido” para descobrir onde virar.

## Comparação item por item

As fontes ao final de cada linha sustentam as funções dos concorrentes. Os códigos E1–E11 apontam para evidências locais explicadas depois das tabelas. A coluna de lacuna explica exatamente o que existe e o que ainda precisa decisão ou comprovação.

### Câmera, mapa e interface

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N001 | Câmera acompanhando posição | Sim, navegação | Referência de condução; ajuste exato NC | **Parcial** | E1/E2: startGuidance + setFollowingPerspective existem; screenshot enviado não demonstra seguimento ativo. | [G1] [S1] |
| N002 | Orientação na direção do movimento | Sim | Referência visual; configuração exata NC | **Código** | E2: TILTED/TOP_DOWN_HEADING_UP; confirmar estabilidade em curvas e parado. | [G1] [S1] |
| N003 | Inclinação 2D/3D | Perspectiva e 3D condicionado | Referência visual; detalhes 3D NC | **Código** | E1/E2/E4: view3D existe; inclinar câmera não equivale a edifícios/terreno 3D enriquecidos. | [G1] [G7] |
| N004 | Explorar mapa e retomar seguimento | Sim | Comportamento de condução a validar visualmente | **Parcial** | E1/E2: Botão próprio de centralizar; falta estado explícito de câmera livre versus seguindo. | [G1] |
| N005 | Zoom inteligente conforme manobra | Novo modo imersivo, condicionado | NC nas fontes consultadas | **Não comprovado** | E2: Não há política própria; comportamento automático do SDK exige teste nativo. | [G7] |
| N006 | Bússola / norte fixo versus direção | Sim | NC quanto ao controle exato | **Ausente** | E1/E2: Não encontrei seletor próprio de norte fixo; heading-up não substitui essa escolha. | [G1] |
| N007 | Enquadrar percurso inteiro | Sim, prévia | Sim, prévia de alternativas | **Código** | E1/E2: showRouteOverview e menu de percurso completo; retorno ao seguimento precisa teste. | [G2] [W1] |
| N008 | Linha do percurso pelas ruas | Sim | Sim | **Parcial** | E2/E4: SDK calcula e desenha; fallback tem mapa/pins, sem motor de instruções. Print sem linha não comprova rota ativa. | [G1] [W1] |
| N009 | Marcador do veículo distinguível dos destinos | Sim, referência enviada | Ícone personalizável | **Parcial** | E2/E4: Chevron do SDK + pins próprios; posição, contraste e sobreposição precisam revisão em movimento. | [G1] [W17] |
| N010 | Destinos numerados e seleção no mapa | Paradas | Destino e parada intermediária | **Código** | E2: Pins numerados com pedido e seleção. Isso já é adaptado à nossa fila de entregas. | [G2] [W9] |
| N011 | Tema dia/noite | Sim | Sim | **Código** | E2/E9: Tema manual força dia/noite; alternância automática por horário não encontrada. | [G1] [W27] |
| N012 | Trânsito e satélite como camadas | Sim | Trânsito na navegação; satélite NC | **Ausente** | E1/E2: Não há seletor próprio dessas camadas. Não confundir mapa de trânsito do provedor com opção exposta. | [G1] |
| N013 | Edifícios, viadutos e terreno 3D enriquecido | Disponibilidade condicionada | Equivalência NC | **Ausente** | E2: Nenhuma integração específica com Immersive Navigation; tilt não entrega essa função. | [G7] |
| N014 | Ocultar controles preservando orientação | Decisão de UX a partir da referência | Não confirmado como função específica | **Parcial** | E1/E2: Toque limpa mapa, mas também oculta header de manobra e informações da viagem. | [G1] |
| N015 | Área útil sem painel cobrindo caminho | Mapa domina a referência enviada | Princípio observado em navegação | **Parcial** | E1: Sheet do pedido continua grande; padding da câmera versus área livre não foi validado. | [G1] [W1] |

### Instruções e progresso

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N016 | Próxima conversão: seta, distância e rua | Sim | Instruções passo a passo | **Parcial** | E2: Header nativo habilitado fora do modo limpo; não validado na viagem mostrada. | [G1] [W2] |
| N017 | Antecipar manobra seguinte | Guias e prévia de manobras | Passos da rota; rotatórias | **Não comprovado** | E2: Delegado ao header; não há estado próprio de duas manobras. Testar conversões seguidas. | [G1] [W2] |
| N018 | Faixa correta antes de virar | Sim | Sim, lane guidance | **Não comprovado** | E2: FAQ confirma suporte nativo, mas nenhum teste local de faixas. Depende de dados da via. | [G1] [S1] [W22] |
| N019 | Orientação em rotatória e saída | Navegação passo a passo | Recurso explícito | **Não comprovado** | E2: Sem lógica própria; verificar número da saída, seta, faixa e voz do SDK. | [G1] [W22] |
| N020 | Instruções por voz | Sim | Sim | **Código** | E2/E9: VOICE_ALERTS_AND_GUIDANCE configurado; validar voz em português e sincronismo da conversão. | [G1] [W4] |
| N021 | Lista completa de manobras | Sim | Sim | **Ausente** | E1/E2: Não existe tela própria; SDK pode permitir percorrer header, mas app não expõe lista dedicada. | [G2] [W2] [S1] |
| N022 | Tempo restante até próxima parada | Sim | Sim | **Código** | E1/E2: seconds renderizado em minutos, mínimo 1; não existe exibição de menos de um minuto. | [G1] [W15] |
| N023 | Distância restante | Sim | Sim | **Código** | E1/E2: meters em km; validar unidade adequada para poucos metros e destino da estimativa. | [G1] [W15] |
| N024 | Horário previsto de chegada, ex. 19:00 | Referência enviada / compartilhamento | ETA | **Ausente** | E1: Tela mostra duração, não horário de chegada. | [G5] [W15] |
| N025 | Tempo e distância de todas as paradas | Viagem com múltiplos destinos | Limite de uma parada intermediária | **Parcial** | E1/E2: Fila existe, porém apenas um valor de seconds/meters, sem previsão separada por pedido. | [G2] [W9] [S1] |
| N026 | Progresso visual da viagem | Rota e progresso | Rota e ETA | **Desativado** | E2: tripProgressBarEnabled=false; footerEnabled=false. Trecho percorrido deve ser validado no SDK. | [G1] [W1] |
| N027 | Recalcular após sair do percurso | Navegação dinâmica | Sugestões e mudanças de rota | **Código** | E2: Listener de desvio e mensagem Recalculando; resultado e câmera ainda exigem teste em campo. | [S1] [W1] |
| N028 | Reconhecer chegada ao destino | Sim | Sim | **Parcial** | E2/E11: onArrival para guidance e informa arrived; chegada operacional é outro estado e exige fluxo do pedido. | [G1] [W15] |
| N029 | Indicar entrada do prédio / lado da rua | Novo modo imersivo condicionado | Equivalência NC | **Ausente** | E1/E2: Temos endereço/observações, não orientação confiável de porta ou lado da rua. | [G7] |

### Escolha de percurso e planejamento

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N030 | Comparar percursos alternativos | Sim | Sim antes/durante | **Parcial** | E2: SDK pode fornecer alternativas, mas não há comparação própria de custo/tempo nem seleção documentada na UI. | [G2] [W1] [S1] |
| N031 | Aceitar ou manter rota quando surge alternativa | Sugestão dinâmica | Aceitar ou recusar sugestão | **Ausente** | E1/E2: Nenhum fluxo próprio para proposta de caminho; listener de rota mudada não é consentimento do usuário. | [G1] [W1] |
| N032 | Evitar pedágios | Sim | Sim | **Ausente** | E2: routingOptions passa apenas travelMode. | [G2] [W10] |
| N033 | Evitar rodovias | Sim | Sim | **Ausente** | E2: Nenhuma preferência de percurso enviada. | [G2] [W10] |
| N034 | Evitar balsas | Opções dependem do produto/versão | Sim | **Ausente** | E2: Nenhum controle ou parâmetro encontrado. | [W10] |
| N035 | Evitar vias não pavimentadas | NC nesta pesquisa | Sim | **Ausente** | E2: Não há preferência equivalente; cobertura do provedor precisa avaliação. | [W11] |
| N036 | Evitar interseções difíceis / áreas de risco | NC como controle geral | Preferências regionais | **Ausente** | E2: Nenhum controle equivalente; não prometer classificação de segurança sem dados. | [W19] |
| N037 | Rodízio, placas, passes, HOV e zonas ambientais | Alguns controles condicionados | Preferências regionais | **Ausente** | E2: Cadastro da moto não fornece essas regras ao navegador. | [G2] [W12] [W19] |
| N038 | Roteamento para motocicleta | Disponibilidade por região | Sim; melhorias em 2026 incluem Brasil | **Ausente** | E2: Aplicativo motoboy utiliza TravelMode.DRIVING. Trocar desenho do veículo não altera cálculo. | [G2] [W3] [W23] [S2] |
| N039 | Estimativa de preço de pedágios | Cidades selecionadas | Sim, estimada | **Ausente** | E1/E2: Não existe preço por percurso; remuneração do pedido é informação diferente. | [G2] [W13] |
| N040 | Percurso mais econômico em combustível | Regiões selecionadas | Equivalência NC | **Ausente** | E2: Nenhuma preferência/estimativa de economia encontrada. | [G6] |
| N041 | Agendar partida ou chegada | Sim, limitações | Sim, planejamento | **Ausente** | E1/E2: Turno operacional não é previsão de trânsito para horário futuro. | [G2] [W14] |
| N042 | Lembrete de hora de sair | Planejamento associado | Sim | **Ausente** | E1/E9: Notificação de oferta não é lembrete calculado pela viagem. | [W21] [W26] |
| N043 | Pesquisar endereço / POI livre | Sim | Sim | **Ausente** | E1: Mapa operacional usa destinos da loja/pedidos; não há pesquisa geral própria. | [G2] [W9] |
| N044 | Pesquisar posto, alimentação e parada no caminho | Sim | Sim | **Ausente** | E1/E2: Não há busca no percurso, cálculo de desvio nem retorno ao destino operacional. | [G1] [W9] |
| N045 | Combustível: preço e posto preferido | POIs; preço local não auditado | Preço editável e preferência | **Ausente** | E1/E2: Nenhuma fonte de postos/preços integrada no app. | [W8] [W19] |
| N046 | Adicionar, remover e reordenar paradas | Até 9 destinos incluindo final | Uma parada intermediária por rota | **Parcial** | E2/E6: Fila e reorder já existem; parada pessoal livre não existe e não deve virar pedido fictício. | [G2] [W9] |
| N047 | Destinos salvos / recentes / casa e trabalho | Recurso relacionado, não aprofundado | Sim | **Ausente** | E1/E9: Lojas vinculadas e histórico de entregas não são favoritos de navegação. | [W19] [W26] |
| N048 | Prévia Street View do destino e do trajeto | Sim, quando disponível | Equivalência NC | **Ausente** | E1/E2: Não há integração de imagens de rua; foto de produto não é foto do destino. | [G2] |
| N049 | Prévia imersiva de rota | Cidades selecionadas | Equivalência NC | **Ausente** | E1/E2: Não integrada. Função diferente da câmera inclinada durante a condução. | [G2] |
| N050 | Encontrar estacionamento / salvar onde parou | Estacionamento no novo modo condicionado | Sim | **Ausente** | E1/E2: Sem busca ou marcador de estacionamento. A FAQ do SDK diz não fornecer busca de estacionamento. | [G7] [W25] [S1] |
| N051 | Personalizar percurso a partir do histórico | Experiência personalizada, escopo variável | Recurso anunciado globalmente em 2026 | **Ausente** | E2/E8: Não há recomendação aprendida de percursos; histórico GPS é registro operacional. | [W23] |

### Alertas e colaboração na estrada

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N052 | Velocímetro atual | Disponibilidade variável | Sim | **Ausente** | E1/E2: GPS envia speedMps, mas tela não apresenta velocímetro próprio. | [G3] [W5] |
| N053 | Limite da via | Disponibilidade variável | Sim | **Parcial** | E2: speedLimitIconEnabled ligado; tabela SDK marca Brasil sem cobertura de limite. Não prometer exibição local. | [G3] [W5] [S2] |
| N054 | Alerta de excesso / limiar configurável | Mudança visual quando disponível | Alerta e limiar | **Ausente** | E1/E9: Nenhum controle próprio de limiar ou som encontrado. | [G3] [W5] |
| N055 | Radares, câmeras e fiscalização por velocidade média | Incidentes condicionados | Câmeras e zonas de fiscalização | **Não comprovado** | E2: Dados/eventos do provedor possíveis, mas não há validação nem configurações próprias. | [G1] [W6] [W21] [S2] |
| N056 | Exibir incidentes ao longo da rota | Sim | Sim | **Não comprovado** | E2: SDK suporta ocorrências em regiões cobertas. Exibir no aparelho não foi demonstrado. | [G1] [W8] [S3] |
| N057 | Reportar trânsito e acidente | Sim | Sim | **Desativado** | E2: reportIncidentButtonEnabled=false e nenhuma chamada própria para abrir painel. | [G1] [W8] [S3] |
| N058 | Reportar polícia / fiscalização móvel | Disponibilidade regional | Sim | **Desativado** | E2: Sem ação no app; disponibilidade específica não se deduz da cobertura genérica Brasil. | [G1] [W8] [S2] |
| N059 | Reportar obra, objeto e faixa bloqueada | Sim | Sim | **Desativado** | E2: Mesmo painel desativado; não existe fluxo local de relato. | [G1] [W8] [S3] |
| N060 | Reportar chuva, alagamento, visibilidade e perigo | Tipos variam | Clima e perigos | **Desativado** | E2: Nenhum formulário próprio; tipos dependem do provedor e região. | [G1] [W8] |
| N061 | Confirmar que incidente ainda existe | Sim, voto | Confirmação de relatos; detalhe por tipo | **Ausente** | E1/E2: Nenhuma UI própria de voto; verificar se SDK expõe prompt padrão antes de projetar outro. | [G1] [W8] |
| N062 | Lombada e faixa elevada | Não confirmado como alerta dedicado | Sim | **Ausente** | E2: Nenhum catálogo/controle próprio. Mapa 3D não substitui aviso de risco para moto. | [W7] [W23] |
| N063 | Curva acentuada e interseção complexa | Orientação; alerta equivalente NC | Sim | **Ausente** | E2: Sem aviso dedicado comprovado no app. | [W7] |
| N064 | Passagem de trem, pedágio e cruzamento rápido | Não confirmado como grupo dedicado | Sim | **Ausente** | E2: Não há configuração de alertas por característica da via. | [W7] |
| N065 | Zona escolar e redução de limite adiante | Não confirmado como equivalente exato | Sim, dados e horários condicionados | **Ausente** | E2: Sem alerta dedicado comprovado. | [W7] [W22] |
| N066 | Faixa acabando, fim de acostamento e ponte estreita | Equivalência NC | Sim | **Ausente** | E2: Não há avisos próprios; especialmente relevantes para motociclista. | [W7] [W23] |
| N067 | Trecho com histórico de acidentes | Equivalência NC | Sim | **Ausente** | E2: Não há base própria nem integração específica. | [W21] |
| N068 | Veículo de emergência parado na via | Equivalência NC | Recurso com cobertura condicionada | **Não comprovado** | E2: Não presumir Brasil a partir do anúncio de 2024; app não integra camada específica. | [W8] [W22] |
| N069 | Alertas de crise: incêndio, enchente e desastre | Sim, condições regionais | Suporte a crise próximo | **Ausente** | E1/E2: Sem fluxo próprio de crise/evacuação; incidentes comuns não são equivalente. | [G8] |
| N070 | Solicitar ajuda na estrada | Equivalência NC | Sim, profissional depende do país | **Parcial** | E11: Suporte/chat da loja existem, mas não são rede de auxílio rodoviário. | [W16] |
| N071 | Preferências de alertas por categoria | Sim, opções de alertas | Sim, mapa e voz separáveis | **Ausente** | E9: Som/vibração são globais; não há seleção de tipos de risco. | [G1] [W6] [W21] |

### Áudio, continuidade, privacidade e integração

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N072 | Som completo / só alertas / mudo | Três modos | Quatro modos no Android atual | **Parcial** | E2/E9: Apenas boolean sound global. Waze inclui menos falante; não há controle separado da navegação. | [G1] [W4] [W23] |
| N073 | Volume independente da orientação | Níveis | Controle de volume | **Ausente** | E9: Sem slider/nível de voz próprio. | [G1] [W4] |
| N074 | Idioma / voz / falar nomes de ruas | Voz e idioma | Vozes e idioma | **Parcial** | E2/E9: SDK fornece voz, app não expõe escolha; português e nomes precisam teste. | [G1] [W20] |
| N075 | Voz personalizada e gravada | Equivalência NC | Sim | **Ausente** | E9: Sem catálogo ou gravação de instruções no app. | [W20] |
| N076 | Saída Bluetooth e comportamento em chamadas | Opções de voz | Opções de Bluetooth/chamadas | **Parcial** | E2/E9: BLUETOOTH_AUDIO configurado; prioridade de áudio/chat e chamadas não validada. | [G1] [W4] [W20] |
| N077 | Música / podcasts controlados no navegador | Comandos Gemini; controles variam | Integração de música | **Ausente** | E1/E9: Não encontrei player de música no modo rota. | [G9] [W20] |
| N078 | Comando de voz e relato conversacional | Gemini durante navegação; Ask Maps tem cobertura distinta | Relato Gemini; busca conversacional beta | **Ausente** | E1/E2: Não há comando de navegação por voz; enviar áudio no chat é outra função. | [G9] [G7] [W20] [W23] |
| N079 | Manter tela acesa durante condução | Experiência de navegação | Opção explícita | **Não comprovado** | E1/E2: Não encontrei keep-awake próprio; verificar comportamento nativo do SDK no aparelho. | [W18] |
| N080 | Orientação com tela apagada / segundo plano | Voz continua | Opções de tela e bloqueio | **Parcial** | E2/E3/E10: CONTINUE_SERVICE configurado, mas blur da tela para guidance; GPS de turno separado continua. | [G1] [W17] [S1] |
| N081 | Continuar após interrupção e reabrir viagem | Experiência a validar por cenário | Experiência a validar por cenário | **Parcial** | E2/E3: Sessão operacional pode ser recuperada; não encontrei restauração completa da câmera/manobra em navegação. | [S1] [W24] |
| N082 | Mapas baixados e cálculo offline | Sim, área e limitações | Não oferece experiência offline equivalente | **Ausente** | E2/E10: SDK tem pré-cache da jornada, não download offline. Fila GPS não calcula novas rotas. | [G4] [W24] [S1] |
| N083 | Perda de GPS e sinalização de posição antiga | Indicador de busca GPS | Diagnóstico GPS | **Parcial** | E2: Timeout inicial de 20s próprio; perda durante viagem depende do SDK, sem indicador próprio de precisão/idade. | [G1] [S1] |
| N084 | Guardar GPS sem rede e reenviar | Navegação offline é outra função | Relatos não ficam em fila offline | **Código** | E10: Fila local de localização já existe com contexto e sequência; mapa offline continua ausente. | [W24] |
| N085 | Compartilhar viagem por link com contato | Sim | Sim | **Ausente** | E1/E7: Preferência de localização do cliente não equivale a link temporário livre para familiares. | [G5] [W15] |
| N086 | Mostrar localização à loja durante turno | Não é operação de delivery destes apps | Não é operação de delivery destes apps | **Código** | E7/E10: Rastreamento operacional com online_idle/active_route; preservar isolamento de usuário/sessão/loja. | [G5] [W15] |
| N087 | Histórico de viagens e trajeto no mapa | Timeline relacionada, não auditada aqui | Histórico de navegação | **Código** | E8: Lista por período, mapa de GPS, pedidos, conferências e ganhos; não garante todo trajeto tenha GPS. | [W28] |
| N088 | Navegação em Android Auto / CarPlay | Integrações próprias | Integrações próprias | **Ausente** | E1/E3: Integração nativa de projeção automotiva do nosso app não encontrada; abrir externo é outra função. | [G7] [W17] |
| N089 | Abrir Maps ou Waze externo | Destino por link | Destino por deep link | **Código** | E5/E9: Preferência só escolhe navegador externo; dentro do app o motor permanece Google. | [S4] |
| N090 | Proteção contra destino sem coordenadas / falha SDK | Dependências de GPS/rota | Dependências de rede/GPS | **Parcial** | E1/E2/E4: Validação e mensagens existem; módulo disponível ainda não comprova autorização e guidance. | [G1] [W24] |

### Funções próprias de entrega que precisam coexistir com a navegação

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N091 | Separar ir à coleta de ir ao cliente | Não é fluxo de pedido | Não é fluxo de pedido | **Código** | E1/E7: Destino da loja antes de retirada/retorno; demais destinos vêm da fila. Validar transição real. | Operação própria |
| N092 | Reordenar sem mover pedido atual ou travado | Não é regra de delivery | Não é regra de delivery | **Código** | E6: expectedVersion, política e locks já usados. Manter regras atuais. | Operação própria |
| N093 | Checklist de retirada por pedido e extras | Não é função destes navegadores | Não é função destes navegadores | **Código** | E11: Itens/quantidades e última conferência dos extras existem; não declarar QA nativo concluído. | Operação própria |
| N094 | Conferência de entrega, código, cobrança e foto | Não é função destes navegadores | Não é função destes navegadores | **Código** | E11: FinishScreen valida pré-condições e submit; chegada do SDK não entrega pedido sozinha. | Operação própria |
| N095 | Continuar para próximo pedido após confirmação | Paradas de viagem | Uma parada intermediária | **Parcial** | E1/E2/E11: onArrival para guidance; não há continueToNextDestination. Validar novo cálculo conforme fila e confirmar que não pula conferência. | [G2] [W9] |
| N096 | Cancelar / atualizar destino durante rota | Alterar viagem | Alterar viagem | **Parcial** | E1/E6/E7: Fila e aviso de atualização existem; efeito no caminho/câmera em andamento não foi testado neste dossiê. | [G2] [W9] |
| N097 | Contato com cliente / loja sem perder navegação | Não é chat de delivery | Não é chat de delivery | **Parcial** | E2/E11: Chat/ligação acessíveis; navegar para outra tela provoca stopGuidance no cleanup. | Operação própria |
| N098 | Identificação da bag e lembrete de extras na chegada | Não é função destes navegadores | Não é função destes navegadores | **Parcial** | E1/E11: Número e checklist existem; aviso resumido de volumes/extras dentro da navegação não encontrado. | Operação própria |

### Controles complementares

| ID | Função / interface | Google Maps | Waze | Nosso estado | Evidência e diferença | Fontes |
| --- | --- | --- | --- | --- | --- | --- |
| N099 | Reportar interdição e evitar rua fechada | Relatos e roteamento | Relato de fechamento | **Desativado** | E2: Não há ação própria de fechar rua. Contornar interdição recebida é tarefa do motor, não da fila de pedidos. | [G1] [W29] [S3] |
| N100 | Alternância automática de tema | Opções dependem de versão | Sim, automático | **Ausente** | E2/E9: FORCE_DAY/FORCE_NIGHT seguem preferência manual; não há automatismo ligado ao modo rota. | [W27] |
| N101 | Unidades de distância km / milhas | Sim | Sim | **Ausente** | E1/E9: Painel formata km fixo; configuração de unidades não encontrada. | [G2] [W17] |
| N102 | Encerrar orientação sem finalizar entrega | Sair da navegação | Parar navegação | **Parcial** | E1/E2: Ver percurso completo chama stopGuidance; não há ação explicitamente rotulada Encerrar navegação separada da entrega. | [G1] [W24] |
| N103 | Personalizar ícone do veículo | Opções de ícone não aprofundadas | Sim, restrição no perfil moto | **Ausente** | E2: Pins de pedidos próprios não são seletor do ícone do motoboy. | [W17] |
| N104 | Lembrete de criança ao chegar | Equivalência NC | Sim | **Ausente** | E1/E9: Não encontrado; avaliar pertinência ao trabalho de motoboy antes de considerar. | [W21] |
| N105 | Lembrete de ligar faróis | Equivalência NC | Sim | **Ausente** | E1/E9: Não encontrado; comportamento é condicional ao país/viagem. | [W21] |
| N106 | Privacidade de visibilidade entre usuários | Compartilhamento controlado | Modo invisível | **Parcial** | E7/E10: Configuração de compartilhar com cliente existe; não é modo invisível na rede pública nem dispensa rastreamento do turno. | [G5] [W17] |

## Evidências locais para conferir sem confiar apenas na descrição

Os números de linha são os do estado auditado; podem mudar quando o código mudar. O nome da função/propriedade permite localizar novamente.

| Código | Arquivos | O que foi conferido |
| --- | --- | --- |
| E1 | [app/mapa.tsx](../../app/mapa.tsx), linhas 22, 38, 56, 63, 65, 67, 72, 74 | Estado following, gating canRoute, mapa limpo, menus, sheet, ETA e CTA. |
| E2 | [components/SdkMapa.tsx](../../components/SdkMapa.tsx), linhas 18–42, 78–130 | Marcadores, callbacks, termos/init, GPS, destinos, orientação, áudio, câmera e controles nativos. |
| E3 | [NativeNavigationProvider](../../src/delivery/NativeNavigationProvider.tsx), linhas 11–24 | Ciclo da sessão e CONTINUE_SERVICE. |
| E4 | [nativeNavigation](../../services/nativeNavigation.ts), [Mapa.native](../../components/Mapa.native.tsx), [LegacyMapa](../../components/LegacyMapa.tsx) | Detectar NavModule, fallback de mapa e câmera sem orientação curva a curva. |
| E5 | [services/navigation.ts](../../services/navigation.ts), linhas 5–20 | Abertura externa por coordenadas/endereço e preferência Maps/Waze. |
| E6 | [app/rota.tsx](../../app/rota.tsx), linhas 17–27; [mobileApi](../../services/mobileApi.ts), linha 386 | Reordenar com versão, política da loja, parada atual e pedidos travados. |
| E7 | [services/routeApi.ts](../../services/routeApi.ts), linhas 12–20 | Destino da loja, pausa, preferências e transferência/recusa. Contratos existentes, não execução em produção. |
| E8 | [historicoRotas](../../app/historicoRotas.tsx), [rotaHistorico](../../app/rotaHistorico.tsx), [routeHistoryApi](../../services/routeHistoryApi.ts), [useRouteHistory](../../src/hooks/useRouteHistory.ts) | Lista por período, detalhe, segmentos GPS, pedidos e valores. pathAvailable informa ausência de GPS. |
| E9 | [theme](../../src/ui/theme.tsx), linhas 18–22; [configuracoes](../../app/configuracoes.tsx), linhas 17–29; [somVibracao](../../app/somVibracao.tsx), linha 26 | Tema manual, sound boolean, navegador externo, movimento reduzido. |
| E10 | [locationSetup](../../components/locationSetup.ts), linhas 89–106; [trackingService](../../services/trackingService.ts), linhas 204–237; [locationTask](../../tasks/locationTask.ts) | Rastreamento do turno e fila de GPS com filtragem; processo separado do motor de orientação. |
| E11 | [retirada](../../app/retirada.tsx), [chegadaEntrega](../../app/chegadaEntrega.tsx), [FinishScreen](../../src/ui/FinishScreen.tsx), linhas 25–31; [confirmacaoEntrega](../../app/confirmacaoEntrega.tsx) | Checklists, extras, chegada operacional, regras de código/pagamento/prova e submit. |

### Problemas confirmados pela leitura

1. **Estado visual antecipado.** `following` começa verdadeiro com `modo=rota`; iniciar também altera esse boolean antes de confirmar guidance. O SDK pode ainda estar carregando, sem GPS, sem autorização, ou indisponível. A UI e o motor não têm a mesma fonte de verdade. E1/E2/E4.
2. **“Conferir” aparece por intenção de navegar.** O CTA usa `arrived || following`; não distingue “quer navegar”, “está navegando” e “chegou”. Isso não prova entrega automática, mas pode induzir uma ação fora de hora. E1.
3. **Modo limpo elimina instrução.** `headerEnabled = routeMode && !mapClean`. Assim, esconder elementos também tira o cabeçalho que informa a conversão. E2.
4. **Roteamento de carro.** `routingOptions` envia apenas `TravelMode.DRIVING`. Cadastro/ícone de moto não altera a malha de roteamento. E2.
5. **Áudio acoplado a avisos.** O mesmo `sound` global controla voz de navegação; não há ajuste independente só-alertas/volume. E2/E9.
6. **Sair da tela para guidance.** Cleanup do efeito condicionado ao foco chama `stopGuidance`. A preferência CONTINUE_SERVICE não anula essa chamada; rastreamento do turno continuar não significa instruções continuarem. E2/E3.
7. **Várias paradas não bastam para comprovar continuidade.** Ao chegar, `onArrival` para guidance. Não há chamada local a `continueToNextDestination`. A fila pode disparar novo cálculo após a operação; é necessário testar confirmação, novo destino e câmera, preservando as regras de entrega. E2/E11.
8. **Resumo de viagem incompleto.** Mostra minutos e km até parada, sem relógio de chegada e sem resumo individual por destino. Footer e barra de progresso nativos estão desligados. E1/E2.
9. **Relatos indisponíveis na UI auditada.** Botão nativo de incidentes desligado, sem substituto encontrado. Exibir ocorrências recebidas, reportar e votar são capacidades diferentes. E2.
10. **Fallback não é navegador.** Expo Go e iOS sem módulo podem exibir LegacyMapa. Isso não entrega instruções curva a curva nem um Waze interno. E4/E5.

### Hipóteses e pontos que não dá para concluir pelo print

- O motivo concreto da câmera distante pode envolver build sem módulo, inicialização/autorização, GPS, estado do motor ou enquadramento. Não é possível escolher uma causa só pela imagem.
- Há `showRouteOverview` após preparar destinos e uma sequência assíncrona para iniciar guidance/câmera. Uma possível disputa de câmera é hipótese a instrumentar, não bug de corrida demonstrado.
- Faixas, manobras seguintes, incidentes recebidos, zoom e comportamento da seta podem ser nativos. Só configuração, pacote instalado ou compilação não provam seu resultado.
- Usar um GPS simulado que muda de coordenadas testa movimento; não valida precisão real, consumo, túneis, suporte do capacete/Bluetooth ou cobertura das ruas.
- Não declarei falha do Google/Waze nem falta de capacidade do SDK por não observar a função no nosso print.

## Cobertura e disponibilidade: o que é viável prometer no Brasil

A tabela oficial do SDK Android lista Brasil com trânsito, direção/snap-to-roads, **duas rodas** e incidentes em tempo real. Ela marca **limites de velocidade e semáforos/placas de parada como indisponíveis ou com baixa qualidade/cobertura**. Polícia e fiscalização móvel têm disponibilidade específica. Isso impede transformar uma opção ligada no código em promessa de cobertura nacional. [S2]

O SDK fornece orientação, callbacks e câmera nativa; também tem recursos que podem ser aproveitados para manobras e previsão por destino. Mas o wrapper 0.16.3 instalado, Android e iOS precisam ter suas APIs e resultados verificados separadamente. Este relatório não aprova atualizar dependências. [S1] [S5]

Maps aplicativo permite baixar áreas. **Navigation SDK não oferece esse modo offline**: usa pré-cache da jornada, que não equivale a baixar a cidade e calcular qualquer viagem sem rede. Waze pressupõe conexão e não dá a mesma experiência de áreas offline. A nossa fila de GPS é uma terceira função, voltada a registrar posições para enviar depois. [G4] [S1] [W24]

O Navigation SDK não fornece busca de estacionamento próximo, segundo a FAQ. Usar o mesmo provedor não entrega automaticamente Places, Street View, estacionamento, rotas econômicas, Immersive Navigation ou Ask Maps. Cada recurso exige capacidade, integração e condições próprias. [S1] [G7]

No Waze, os deep links abrem aplicativo/site externo. A implementação atual faz isso; não embute sua interface nem concede acesso à rede de relatos como dados do nosso app. Qualquer outra parceria/capacidade exigiria análise própria, sem presumir um SDK público equivalente ao Google. [S4]

## Impacto técnico para decidir, sem criar endpoints desnecessários

| Família | Caminho provável após eventual aprovação | O que reaproveitar / validar |
| --- | --- | --- |
| Câmera, orientação, estados e header | Mobile + SDK existente | Primeiro confirmar init, GPS, rota, guidance e perspectiva; corrigir estado derivado da intenção. |
| Tempo, distância, chegada e próxima parada | Mobile + callbacks; capacidade de previsão por destino do SDK | Não calcular distância em linha reta como se fosse distância de percurso. |
| Voz, tema, controles e acessibilidade | Preferências mobile e UI nativa | Separar áudio da navegação de som de ofertas; preservar design aprovado. |
| Moto e restrições de percurso | Configuração de roteamento e preferências | Confirmar APIs do wrapper e cobertura; não criar um roteador próprio no backend. |
| Incidentes | UI/recursos permitidos do SDK | Diferenciar receber, reportar e votar; confirmar cobertura e exposição no wrapper. |
| Busca no caminho, posto, estacionamento | Integração complementar de lugares/dados | Não considerar incluído na licença ou API de navegação só porque aparece no Maps consumidor. |
| Compartilhar viagem | Produto e API de compartilhamento com escopo/expiração, se aprovado | Reaproveitar rastreamento e preferência do cliente; backend só se faltar contrato adequado. |
| Histórico operacional | Contratos existentes routeHistory/routeHistoryDetail | Já há lista/detalhe/segmentos; verificar dados reais e escopo da loja antes de criar qualquer API nova. |
| Checklist, chegada e próximo pedido | Fluxo operacional existente | Reaproveitar pickup, arrive, queue, completion e locks. Não substituir confirmação por evento GPS. |
| Continuidade em segundo plano | Ciclo de vida nativo e sessão do app | Separar serviço de rastreamento de motor de voz/câmera; testar chat, ligação, bloqueio e retorno. |

São caminhos prováveis, não estimativas fechadas nem aprovação para mexer no mobile, backend ou admin. A implementação de cada ID só deve entrar em lote após a escolha do Farley e a verificação do contrato/capacidade já existente.

## Minha recomendação para a seleção

Primeiro decidir o núcleo que faz a tela ser um navegador confiável: **N001, N002, N004, N008, N016–N020, N022–N024, N027–N028, N038, N072, N079–N081, N083, N090, N095 e N097**. São câmera, percurso, instruções, progresso, recalcular, moto, som, continuidade e tratamento de falha.

Depois decidir conforto e operação: mapa limpo preservando instruções, painel compacto, relógio de chegada, informações por parada e transição coleta/entrega. Esses itens não exigem copiar todas as funções de um aplicativo de trânsito.

Por último escolher diferenciais: riscos para motociclista, incidentes, busca no caminho, compartilhamento e extras de personalização. Lembrete de criança, entretenimento e projeção automotiva estão inventariados, mas têm menor relação direta com a entrega em moto.

**Os IDs acima são sugestão para discussão. Nenhum deles está aprovado.** Na planilha, preencher a decisão com “Implementar”, “Adiar”, “Não quero” ou “Preciso ver desenho”, e registrar prioridade/observação. Pode decidir também pelas famílias das tabelas.

## Como comprovar um modo rota de verdade quando os itens forem aprovados

A futura validação deve registrar build, plataforma, versão SDK, sessão, estados, GPS e captura/vídeo, sem expor credenciais. Critérios mínimos propostos:

1. Só indicar orientação ativa depois de sucesso do motor; falha exibe estado honesto e caminho de recuperação.
2. Veículo visível no eixo horizontal, estrada à frente, câmera acompanhando posição e direção sem saltos; enquadramento considera painéis.
3. Próxima conversão mostra seta, distância e rua antes da curva; testar duas conversões próximas, rotatória e saída de via rápida.
4. Percurso desenhado por ruas entre posição real e destino certo; distinguir loja/coleta, cliente, seleção de outra parada e retorno.
5. Desvio intencional recalcula, atualiza instrução/ETA e não fica preso ao trajeto anterior.
6. Explorar mapa libera gesto; retomar restaura seguimento. Modo limpo conserva a orientação essencial acordada.
7. Testar parar/retomar, telefone imóvel, GPS ruim, GPS perdido e rede intermitente, sem fingir posição atual.
8. Voz audível e sincronizada em português; testar mudo/só-alertas quando escolhidos, Bluetooth, ligação e áudio do chat.
9. Testar chat, troca de tela, app em segundo plano, tela bloqueada, reabertura e encerramento: resultado explícito de continuidade.
10. Chegar não entrega sozinho: número, itens/extras, código, pagamento e comprovante continuam governados pela operação.
11. Após finalizar, seguir para próxima parada sem orientar à anterior; cancelamento/ordem alterada atualiza percurso sem duplicar conclusão.
12. Validar Android físico além de emulador; iOS separadamente antes de prometer paridade. Captura Web não atende estes critérios.

Nenhum desses testes foi executado nesta tarefa; são critérios para a implementação futura escolhida.

## Fontes oficiais consultadas

As referências das tabelas abrem a página exata. Consultadas em 09/10/2026. Anúncios informam a data de lançamento/implantação, não comprovação de disponibilidade individual. Não foram reproduzidos textos integrais nem conteúdo comunitário.

- **G1** — [Navegação no Google Maps](https://support.google.com/maps/answer/3273406?hl=en)
- **G2** — [Rotas, paradas e planejamento — Android](https://support.google.com/maps/answer/144339?co=GENIE.Platform%3DAndroid&hl=en)
- **G3** — [Velocidade no Google Maps](https://support.google.com/maps/answer/9356324?hl=en)
- **G4** — [Maps offline](https://support.google.com/maps/answer/6291838?co=GENIE.Platform%3DAndroid&hl=en)
- **G5** — [Compartilhar localização e viagem](https://support.google.com/maps/answer/15437054?co=GENIE.Platform%3DAndroid&hl=en)
- **G6** — [Rotas econômicas](https://support.google.com/maps/answer/11470237?co=GENIE.Platform%3DAndroid&hl=en)
- **G7** — [Immersive Navigation — anúncio de 12/03/2026](https://blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/)
- **G8** — [Alertas de crises no Maps](https://support.google.com/maps/answer/9985621?hl=en)
- **W1** — [Rotas alternativas no Waze](https://support.google.com/waze/answer/6262424?hl=en)
- **W2** — [Passo a passo da rota](https://support.google.com/waze/answer/6273629?hl=en)
- **W3** — [Tipo de veículo](https://support.google.com/waze/answer/7579259?hl=en)
- **W4** — [Som, modos e volume](https://support.google.com/waze/answer/6273671?hl=en)
- **W5** — [Velocímetro e excesso de velocidade](https://support.google.com/waze/answer/6386895?hl=en)
- **W6** — [Radares e câmeras](https://support.google.com/waze/answer/15758855?hl=en)
- **W7** — [Características da via](https://support.google.com/waze/answer/14964557?hl=en)
- **W8** — [Reportar trânsito, polícia, acidentes, clima e perigos](https://support.google.com/waze/topic/14098147?hl=en)
- **W9** — [Adicionar parada](https://support.google.com/waze/answer/6262564?hl=en)
- **W10** — [Evitar pedágios, balsas e rodovias](https://support.google.com/waze/answer/6262566?hl=en)
- **W11** — [Evitar vias não pavimentadas](https://support.google.com/waze/answer/14600080?hl=en)
- **W12** — [Rodízio e restrição por placa](https://support.google.com/waze/answer/7666525?hl=en)
- **W13** — [Comparar pedágios](https://support.google.com/waze/answer/9370512?hl=en)
- **W14** — [Planejar viagem](https://support.google.com/waze/answer/6378906?hl=en)
- **W15** — [Compartilhar viagem](https://support.google.com/waze/answer/6273627?hl=en)
- **W16** — [Ajuda na estrada](https://support.google.com/waze/answer/7572657?hl=en)
- **W17** — [Personalização do mapa](https://support.google.com/waze/topic/13773071?hl=en)
- **W18** — [Tela sempre ligada](https://support.google.com/waze/answer/6090013?hl=en)
- **W19** — [Preferências de condução e histórico](https://support.google.com/waze/topic/7060168?hl=en)
- **W20** — [Preferências de áudio, Bluetooth e música](https://support.google.com/waze/topic/6268710?hl=en)
- **W21** — [Alertas, zonas e lembretes](https://support.google.com/waze/topic/7060192?hl=en)
- **W22** — [Rotatórias e mudanças de limite — anúncio de 05/03/2024](https://blog.google/waze/6-updates-to-waze-to-help-you-get-around-safely-and-conveniently/)
- **W23** — [Moto, personalização, less chatty e Gemini — 13/07/2026](https://blog.google/waze/waze-updates-gemini-motorcycle-mode/)
- **W24** — [Internet e limitações do Waze](https://support.google.com/waze/answer/6071177?hl=en)
- **W25** — [Estacionamento](https://support.google.com/waze/answer/7052890?hl=en)
- **W26** — [Sugestões de viagens](https://support.google.com/waze/answer/9747181?hl=en)
- **S1** — [FAQ oficial Navigation SDK Android](https://developers.google.com/maps/documentation/navigation/android-sdk/faq)
- **S2** — [Cobertura do Navigation SDK por país](https://developers.google.com/maps/documentation/navigation/android-sdk/coverage-nav-sdk)
- **S3** — [Incidentes em tempo real no SDK](https://developers.google.com/maps/documentation/navigation/android-sdk/real-time-disruptions)
- **S4** — [Integração Waze por deep links](https://developers.google.com/waze/deeplinks)
- **S5** — [Wrapper React Native oficial](https://github.com/googlemaps/react-native-navigation-sdk)
- **G9** — [Gemini durante navegação Android](https://support.google.com/maps/answer/6041199?hl=en)
- **W27** — [Tema automático no Waze](https://support.google.com/waze/answer/13772684?hl=en)
- **W28** — [Histórico do Waze](https://support.google.com/waze/answer/9747278?hl=en)
- **W29** — [Interdições de ruas](https://support.google.com/waze/answer/13753511?hl=en)

[G1]: https://support.google.com/maps/answer/3273406?hl=en
[G2]: https://support.google.com/maps/answer/144339?co=GENIE.Platform%3DAndroid&hl=en
[G3]: https://support.google.com/maps/answer/9356324?hl=en
[G4]: https://support.google.com/maps/answer/6291838?co=GENIE.Platform%3DAndroid&hl=en
[G5]: https://support.google.com/maps/answer/15437054?co=GENIE.Platform%3DAndroid&hl=en
[G6]: https://support.google.com/maps/answer/11470237?co=GENIE.Platform%3DAndroid&hl=en
[G7]: https://blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/
[G8]: https://support.google.com/maps/answer/9985621?hl=en
[W1]: https://support.google.com/waze/answer/6262424?hl=en
[W2]: https://support.google.com/waze/answer/6273629?hl=en
[W3]: https://support.google.com/waze/answer/7579259?hl=en
[W4]: https://support.google.com/waze/answer/6273671?hl=en
[W5]: https://support.google.com/waze/answer/6386895?hl=en
[W6]: https://support.google.com/waze/answer/15758855?hl=en
[W7]: https://support.google.com/waze/answer/14964557?hl=en
[W8]: https://support.google.com/waze/topic/14098147?hl=en
[W9]: https://support.google.com/waze/answer/6262564?hl=en
[W10]: https://support.google.com/waze/answer/6262566?hl=en
[W11]: https://support.google.com/waze/answer/14600080?hl=en
[W12]: https://support.google.com/waze/answer/7666525?hl=en
[W13]: https://support.google.com/waze/answer/9370512?hl=en
[W14]: https://support.google.com/waze/answer/6378906?hl=en
[W15]: https://support.google.com/waze/answer/6273627?hl=en
[W16]: https://support.google.com/waze/answer/7572657?hl=en
[W17]: https://support.google.com/waze/topic/13773071?hl=en
[W18]: https://support.google.com/waze/answer/6090013?hl=en
[W19]: https://support.google.com/waze/topic/7060168?hl=en
[W20]: https://support.google.com/waze/topic/6268710?hl=en
[W21]: https://support.google.com/waze/topic/7060192?hl=en
[W22]: https://blog.google/waze/6-updates-to-waze-to-help-you-get-around-safely-and-conveniently/
[W23]: https://blog.google/waze/waze-updates-gemini-motorcycle-mode/
[W24]: https://support.google.com/waze/answer/6071177?hl=en
[W25]: https://support.google.com/waze/answer/7052890?hl=en
[W26]: https://support.google.com/waze/answer/9747181?hl=en
[S1]: https://developers.google.com/maps/documentation/navigation/android-sdk/faq
[S2]: https://developers.google.com/maps/documentation/navigation/android-sdk/coverage-nav-sdk
[S3]: https://developers.google.com/maps/documentation/navigation/android-sdk/real-time-disruptions
[S4]: https://developers.google.com/waze/deeplinks
[S5]: https://github.com/googlemaps/react-native-navigation-sdk
[G9]: https://support.google.com/maps/answer/6041199?hl=en
[W27]: https://support.google.com/waze/answer/13772684?hl=en
[W28]: https://support.google.com/waze/answer/9747278?hl=en
[W29]: https://support.google.com/waze/answer/13753511?hl=en
