# ZippyGo — fluxos e decisões de produto

Protótipo conceitual de 06/10/2026. Os nomes, endereços, pedidos, posições, valores e conversas são fictícios. O código desta pasta apresenta a proposta; não implementa recursos do aplicativo.

## Jornada principal

Boas-vindas → entrar/cadastrar/recuperar acesso → permissões contextualizadas → estabelecimento vinculado → início offline → ficar online → mapa/aguardar oferta → analisar oferta → aceitar → conferir sequência → chegar à coleta → conferir volumes e retirar → navegar → chegar ao cliente → conferir código quando exigido → conferir recebimento quando devido → comprovar entrega quando a política exigir → arrastar para concluir → recibo → próxima parada → retorno à loja quando exigido → disponível → encerrar turno → conferir acerto.

Acesso direto a telas na apresentação serve para revisão. No percurso real, permissões, vínculo e política do estabelecimento controlam cada passagem.

## Mapa de possibilidades

| Momento | Caminho principal | Alternativas e recuperação |
|---|---|---|
| Acesso | Login válido | senha incorreta, recuperar, cadastro, conta pendente, sessão expirada, outro aparelho |
| Vínculo | Selecionar vínculo aprovado | buscar loja, solicitar, pendente, recusado com motivo, convite aceitar/recusar, nenhum vínculo, estabelecimento inativo |
| Preparar turno | Permissões e ficar online | localização negada, GPS desligado/impreciso, internet ausente, bateria restrita, notificações negadas, trocar loja de forma controlada |
| Disponível | Online e aguardando | pausa sem novos chamados, offline, mapa livre, mensagens, notificação, oferta atribuída conforme política |
| Oferta | Aceitar dentro do prazo | recusar com motivo, expirar, oferta retirada/cancelada, estado atualizado no servidor |
| Rota | Ordem sugerida | reordenar quando permitido, paradas fixas, conflito de versão, novo pedido na rota, transferência permitida/aprovada/bloqueada |
| Coleta | Checklist e retirada | pedido em preparo, volume faltando, loja fechada, atraso, erro/cancelamento, falar com atendente |
| Navegação | Próximo destino em destaque | modo rota com acompanhamento, visão geral, Só mapa/Mostrar controles, modo 2D/3D, recentralizar, abrir navegador preferido, GPS impreciso, sem rede, endereço divergente, ocorrência |
| Chegada | Cliente + instruções | portaria, sem contato, cliente ausente, telefone indisponível, canal iFood/WhatsApp indisponível |
| Código | Código validado pelo serviço | incorreto, indisponível, política dispensa código, sem rede não permite validar, pedir ajuda |
| Cobrança | Recebimento conferido | já pago, dinheiro com troco, Pix confirmado, débito/crédito, duas formas, valor divergente, pagamento recusado |
| Comprovante | Foto quando exigida | não exigido, imagem inadequada/refazer, câmera negada, preservar privacidade, anexar observação |
| Conclusão | Arraste após pré-requisitos | arraste incompleto, erro de código/servidor, sem internet fica pendente, duplicidade idempotente na implementação futura |
| Depois da entrega | Próxima parada | última parada, retorno obrigatório, devolução, fila suspensa/retomar, pedido cancelado no painel |
| Chat | Loja, cliente, colega, grupo | texto, atalhos, áudio, anexos, resposta, reação, localização, contexto do pedido, busca, silêncio, envio pendente/falhou/reenviar, canal indisponível, moderação |
| Fechamento | Resumo e acerto | valores a receber × dinheiro da loja, ajuste contestado, comprovante, pendências bloqueiam fechamento operacional, histórico |
| Conta | Perfil e configurações | editar dados, veículo/documentos, tema/noite, reduzir movimento, sons/vibração, privacidade, suporte, sair |

## Regras essenciais

1. **Online é diferente de ter internet.** O turno pode estar ativo enquanto a rede cai. Mostrar último envio e fila pendente; não apresentar localização antiga como atual.
2. **Compartilhamento com loja desde o online.** Posicionamento e atualização continuam durante espera, coleta, rota e retorno. Offline encerra a coleta/transmissão operacional. Cliente só acompanha quando autorizado e dentro do contexto do pedido.
3. **Trocar estabelecimento exige transição de sessão.** Com rota, bloquear troca e explicar o caminho de conclusão/transferência. Sem rota, encerrar a sessão atual, confirmar a troca e iniciar outra; não mostrar duas lojas operando simultaneamente.
4. **Oferta tem validade do servidor.** Aceitar/recusar precisa revalidar. Em expiração, pedidos voltam à loja; o protótipo tem um estado dedicado. Uma pausa não apaga rota aceita.
5. **Sequência é compartilhada.** Primeiro/último podem estar fixos. Mudança externa precisa revisão e nova confirmação; não sobrescrever silenciosamente uma fila mais recente.
6. **Código permanece visível.** Depois de validado fica verde e desabilitado. Nunca inventar validade offline. Na simulação o código demonstrativo é `4821` e qualquer outro apresenta erro.
7. **Cobrar não é receber.** Escolher método ou abrir a tela não marca pagamento. Conferir recebimento prepara um resumo; pagamento e entrega são registrados somente no arraste final. Pix/maquininha exigem conferência efetiva. Contrato transacional de backend ainda deve ser planejado.
8. **Divisão soma exatamente o total.** Duas partes devem estar positivas, somar R$ 86,90 e ter recebimento conferido. Dinheiro: recebido ≥ parcela e troco explícito. Não autoaprovar uma parte.
9. **Finalizar não pula requisitos.** Código + pagamento + foto quando exigidos. Arrastar libera a confirmação; mudança de estado deve respeitar resposta do servidor. Sem rede: registro pendente, próxima parada bloqueada até resolver/sincronizar conforme política.
10. **Grupo é comunicação.** Não despacha nem transfere pedido automaticamente. Transferência tem tela, confirmação e política próprias.
11. **Cliente não é canal universal.** Mostrar origem e indisponibilidade por iFood, janela fechada ou conversa inexistente. Alternativa: falar com estabelecimento e usar o canal permitido. A implementação existente envia pelo canal da loja, não pelo WhatsApp pessoal do motoboy.
12. **Não premiar pressa.** Animação de conquista comunica entrega conferida e turno organizado. Sem ranking de velocidade, cronômetro de corrida ou incentivos a correr. Durante deslocamento, mapa e voz ganham prioridade; chat pressupõe parada segura.
13. **Dados pessoais minimizados.** Histórico usa bairro em vez de endereço completo; localização para cliente limitada ao pedido; documentos e consentimentos com acesso específico.
14. **Mapa livre de obstruções.** O motoboy pode ocultar cabeçalho, instrução, cartões, pins de pedidos e navegação inferior sem interromper o mapa, o rastreamento ou a rota. Um botão compacto restaura os controles. Modo rota e modo de visualização limpa são preferências independentes.

## Inventário de telas

O inventário navegável completo está no array `screens` de `prototype.js`. Ele é a fonte dos títulos, objetivos, estados, capítulos e galeria. Cada tela tem uma composição visual renderizada, e os estados adicionais podem ser acessados diretamente pelo menu ou pelo painel de revisão.

Capítulos: acesso/vínculo; turno/mapas; rota/coleta; entrega/pagamento; comunicação; conta/fechamento; exceções. A apresentação tem protótipo interativo, galeria de todas as telas, fluxos por capítulos e pesquisa de mercado.

## O que já tem base e o que é proposta

| Recurso | Evidência | Situação |
|---|---|---|
| Cadastro/vínculos/convites | OnboardingController + mobileApi | Base existente; protótipo redesenha |
| Sessão/online/localização | TrackingV2Controller + trackingService | Base existente; diagnóstico e transparência propostos |
| Ofertas/fila/coleta/chegada/entrega/falha/retorno | TrackingV2Controller + SimulatedRider | Base existente; novos layouts e estados |
| Loja/grupo/cliente | endpoints messages/group-messages/client-messages | Integração nativa inicial de texto; leitura operacional do cliente adicionada; mídia e demais interações pendentes |
| Transferência | transfer-targets/transfers + política | Base existente; apresentação mobile proposta |
| Código | Deliver recebe código | Base existente; validação antecipada dedicada exige contrato |
| Dividir/cobrar | dividirPagamento.tsx | UI local existente; registro financeiro transacional não comprovado |
| Chat direto entre colegas | nenhum endpoint comprovado na auditoria | Proposta obrigatória do usuário |
| Áudio/imagem/reação/resposta/busca no chat | mensagens existentes textuais | Proposta; armazenamento/moderação/permissões futuros |
| Foto/comprovante de entrega | não comprovado | Proposta opcional por política |
| Ganhos/acerto/contestação | referência operacional; contrato mobile não comprovado | Proposta; diferenciar repasse de cobrança da loja |
| Segurança/contato de confiança | referências de mercado | Proposta; protótipo não liga nem comunica ninguém |

## Linguagem visual e movimento

- Branco luminoso permite ler formulários e conversas ao sol; azul profundo organiza mapas e cartões em profundidade; azul vivo sinaliza ações e foco; cobre/âmbar sinaliza espera; vermelho indica problema, sempre acompanhado de texto. Verde fica na confirmação do código validado. Esta revisão substitui a paleta anterior, rejeitada pelo usuário em 07/10.
- Cartão de turno tem foco de luz que acompanha o cursor. A maquete da rota tem edifícios e pontos em camadas; alterar 2D/3D muda perspectiva. Pins numerados unem lista e mapa.
- Entrada das telas: 220–360 ms. Lista: pequeno atraso progressivo. Código correto: encaixe e halo. Slide final: preenchimento, selo em relevo e recibo. Sucesso: celebração breve. Enquanto navega: apenas pulso/traço essenciais.
- Todas as microinterações têm equivalentes sem movimento. `prefers-reduced-motion`, configuração manual e modo de economia devem remover ciclos decorativos. Não depender de som, cor ou animação para entender estados.
- Alvos importantes têm pelo menos 44 px, área inferior reservada, foco de teclado, labels e contraste. 3D e fontes foram mantidos locais; mapas são ilustrativos, não geográficos.

## Validação de implementação futura

Validar em aparelho real: alcance com uma mão, sol, chuva/luvas, suporte na moto, leitor de tela, fonte ampliada, bateria, GPS em segundo plano, Android 13+, reconexão, retomada após encerramento do processo e concorrência painel/mobile. Confirmar contratos, políticas financeiras, canal do cliente e governança de grupo antes de construir funcionalidades. Esta fase termina no design e protótipo local.
