# Etapa 1 — base visual e detalhes do pedido

Data: 07/10/2026. Escopo aprovado: priorizar o visual nativo e reutilizar somente o backend existente. Sem alterações no backend/painel, commit, push ou publicação.

## Alterações

- `src/ui/theme.tsx`: medidas compartilhadas de espaçamento, raios, toque, largura e movimento; tolerância a falhas ao carregar preferências.
- `src/ui/Kit.tsx`: tipografia legível, conteúdo centralizado até 480 px, rodapé com altura medida (inclusive com texto ampliado), áreas de toque de 44 px, cartões com profundidade, botões, campo reutilizável com label/foco/erro e feedback de carregamento/indisponibilidade. Preserva Manrope, paleta e preferências existentes.
- `app/pedido/[id].tsx`: tema claro/escuro persistido, ficha do pedido, itens/fotos reais, fallback de imagem, conferência, contatos e navegação externa. Não mostra quantidade zero como dado real quando não há itens; não marca coleta antes da resposta do servidor; trata previsão inválida. Ignora retorno da ação de chegada se a tela/sessão mudou e confere a parada retornada antes de abrir a finalização legada.

## Contratos reutilizados

- `GET /api/v2/motoboys/me/session/orders/{id}`: itens, fotos, cliente, endereço, valores e requisitos do pedido autorizado.
- `POST /api/v2/motoboys/me/session/stops/current/arrive`: envia `expectedPedidoId`, já aceito e verificado pelo backend deste checkout.
- Conversas permanecem nas rotas existentes; navegação externa/discador só abrem por ação do usuário.

A inspeção atual confirmou os contratos de detalhe, canal/consulta do cliente e contatos no backend. A observação inicial de ausência desses arquivos não representa este checkout atual. Não foi necessário substituir o endpoint de detalhes pela fila nem editar `services/mobileApi.ts`.

## Limites

- Esta etapa não substitui a finalização legada nem implementa cobrança/divisão/comprovante.
- O HTML de 61 telas permanece intacto; ele não é a implementação Expo.
- Sem dados reais disponíveis, a tela informa ausência/erro; dados demonstrativos pertencem exclusivamente ao roteiro de revisão em `docs/validacao-etapa1/`.
- Validação com API interceptada verifica apresentação e pedidos HTTP, sem comprovar integração com API/banco reais. GPS, câmera, notificações e acessibilidade nativa exigem aparelho Android.

## Validação

TypeScript e `git diff --check` passaram. Bundle Expo Web concluído; sete cenários de revisão passaram com API interceptada: pedido/foto, temas e persistência, 320 px, texto ampliado em CSS, erro/retry/dados ausentes, chegada com ID e central de conversas. Sem erros JavaScript de página. Capturas inspecionadas; ajustes de cartão estreito e quebra de linha da sequência aplicados.

Evidências e limitações: [validação da etapa 1](../validacao-etapa1/README.md). Etapa 1 visual implementada e revisada em web; Android e integração com API de teste reais continuam pendentes. A instalação reproduzível do lockfile também exige revisão futura.
