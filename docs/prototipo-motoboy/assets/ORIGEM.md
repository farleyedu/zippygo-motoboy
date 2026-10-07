# Origem dos elementos visuais

## Capacete 3D

Original: `capacete-3d.png`, 1280 × 1280, com transparência. Gerado com o **tool embutido imagegen**, em 06/10/2026, seguindo a skill `imagegen`. Original preservado em `C:/Users/farle/.codex/generated_images/01a11446-f30a-7120-94c4-fc8fa026419c/exec-5a892d70-2bd9-494c-9ba9-1a1b6cd7c804.png` e cópia local nesta pasta.

**Versão atual usada na interface: `capacete-3d-azul.png`**, editada com o mesmo tool em 07/10/2026 para acompanhar a nova paleta. Mantém geometria, enquadramento, materiais e transparência do original; troca a iluminação verde por azul. Cópia também em `zippygo-motoboy/assets/images/capacete-3d-azul.png`. Arquivo gerado preservado em `C:/Users/farle/.codex/generated_images/01a11446-f30a-7120-94c4-fc8fa026419c/exec-311e978e-2e54-4dca-a89f-4b0dd6d518f9.png`. Usado pontualmente em boas-vindas e cartão de turno.

Prompt final utilizado:

> Use case: stylized-concept. Asset type: original 3D hero artwork for ZippyGo motorcycle courier mobile app prototype. Primary request: a single beautifully crafted premium full-face motorcycle helmet floating in a three-quarter view, isolated on a truly transparent background. Materials: warm ivory satin ceramic shell, sculptural smoked black glossy visor, one precise luminous acid-lime yellow trim around the visor, subtle brushed copper mechanical accents and fine realistic vents. Style: high-end industrial product render, exceptional physical detail, realistic studio photography of a three-dimensional object, not a cartoon. Lighting: generous soft white studio key light, warm rim light, electric-lime reflection on the visor, refined ambient occlusion. Composition: helmet fills most of square frame, facing to the right, no floor, no props, no extra objects, no people, no text or logo, no watermark. Render highly legible at mobile size and suitable on both ivory and graphite backgrounds.

Prompt da edição azul:

> Edit target: the provided original transparent motorcycle helmet product render for the ZippyGo courier app. Change only the luminous acid-lime visor trim and its green reflections to a vivid electric cobalt-blue glow, matching a premium white, midnight blue, electric blue and copper mobile app palette. Keep exactly the helmet geometry, three-quarter camera angle, ivory shell, black smoked glossy visor, copper hardware, vents, lighting, textures, framing and dimensions. Preserve the fully transparent background and original alpha edges. No other objects, no logos, no text. The result must still be a realistic premium 3D industrial product render with a refined electric-blue luminous accent.

## Fotos de produtos do catálogo existente

`catalogo-pizza-calabresa.jpg` e `catalogo-refrigerante-2l.jpg` são cópias das fotos já referenciadas em `cardapio_produto.imagem_url`, consultadas em 07/10/2026 em transação somente leitura. Entraram no protótipo a pedido do usuário para reaproveitar o catálogo. A cópia local mantém a apresentação offline. Não foram geradas nem tratadas. No app, usar `PedidoItemDto.ImagemUrl`, resolvido pelo `produto_id` e estabelecimento no repositório existente; não fixar essas fotos para pedidos reais.

- Pizza de Calabresa: https://ilpartigiano.com.ar/images/cache/tpt700x700/2025/01/ilpartigiano/entities/calabresa-29222923.jpg
- Refrigerante 2 Litros: https://static.wixstatic.com/media/bc10b0_454a6bf5433b406997e5765bf1627d4d~mv2_d_1200_1200_s_2.jpg/v1/fill/w_980%2Ch_980%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_auto/bc10b0_454a6bf5433b406997e5765bf1627d4d~mv2_d_1200_1200_s_2.jpg

A imagem `pizza-pedido.png` foi uma proposta gerada antes dessa correção e não é utilizada na interface. Original mantido em `C:/Users/farle/.codex/generated_images/01a11446-f30a-7120-94c4-fc8fa026419c/exec-e2a069b9-75f8-4519-85cf-422daeac427c.png`; não usar como substituição das fotos do catálogo.

## Fonte local

`manrope.woff2`: Manrope variável, pesos 200–800, subconjunto latino. Obtida do [Google Fonts](https://fonts.google.com/specimen/Manrope), com a licença **SIL Open Font License** incluída em `OFL-Manrope.txt`. O arquivo é local e não exige acesso à internet.

O app nativo usa `assets/fonts/Manrope-Variable.ttf`, da mesma família e licença, carregada localmente pelo Expo. A fonte não foi substituída na revisão da paleta.

## Mapas e elementos de interface

Mapa ilustrativo, edifícios em perspectiva, linhas de rota, pins, ícones de traço, volumes, radar, selo e recibo foram compostos em SVG/HTML/CSS. São elementos do protótipo, sem dados de mapa geográfico ou marca de terceiros. Animações usam CSS e SVG; o movimento reduzido pausa também as animações SVG.
