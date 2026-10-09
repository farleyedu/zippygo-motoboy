# Ícone do ZippyGo — 09/10/2026

A pedido do Farley, o ícone genérico do Expo e a abertura foram substituídos inicialmente no checkout **`zm57` / `upgrade/expo-sdk-57`**. Em 09/10/2026, Farley autorizou integrar esse trabalho no **`zippygo-motoboy` / `master`**, que passa a ser o checkout vigente. Os arquivos do print são recursos Android por resolução, não pins do mapa.

A identidade usa o capacete já aprovado, redesenhado com formas mais limpas para o ícone. A arte foi criada com a ferramenta integrada `imagegen`, com fundo realmente transparente. Referência de estilo: `assets/images/capacete-3d-azul.png`; esse asset e as telas aprovadas não foram alterados.

## Arquivos e reprodução

- Arte-mestra: [`splash-icon.png`](../../assets/images/splash-icon.png), PNG RGBA 1254 × 1254.
- Ícone opaco para instalação/iOS: [`icon.png`](../../assets/images/icon.png), 1024 × 1024, fundo `#1854cd` e margem para máscaras.
- Foreground adaptativo: [`adaptive-icon.png`](../../assets/images/adaptive-icon.png), 1024 × 1024 transparente, preparado para a área segura circular Android.
- Favicon: [`favicon.png`](../../assets/images/favicon.png), 64 × 64.
- Prévia local: [`icone.html`](icone.html), incluindo tamanhos pequenos, máscara adaptativa e abertura.
- Gerador: [`scripts/generate-brand-assets.cjs`](../../scripts/generate-brand-assets.cjs). Executar `node scripts/generate-brand-assets.cjs` na raiz do **zippygo-motoboy**. Usa os geradores instalados do Expo; não requer outra geração de imagem, API ou novas dependências. A configuração de origem vem do `app.config.ts`.

O gerador produz os 15 recursos de launcher e os cinco da abertura nas densidades mdpi, hdpi, xhdpi, xxhdpi e xxxhdpi. São derivados necessários para o Android. Atualiza apenas esses recursos, os dois XMLs de launcher e as cores de ícone/abertura; preserva as alterações de Gradle e navegação. Não executar `prebuild --clean` para esta troca.

A abertura nativa usa fundo `#10192b` e imagem com largura 168 dp. O sistema operacional controla a apresentação. O Expo Go mantém seu próprio ícone e sua própria abertura; para ver estes recursos, reconstruir/reinstalar o aplicativo nativo. No iOS, a origem já está configurada, mas não há build iOS neste ambiente.

## Origem da arte

Modo: ferramenta integrada `imagegen`; não foi usada a CLI. Original preservado em `C:/Users/farle/.codex/generated_images/01a11446-f30a-7120-94c4-fc8fa026419c/exec-62994255-3f03-4746-87c1-6e76eab1b80b.png` e copiado para a arte-mestra no projeto.

Prompt usado:

```text
Use case: stylized-concept.
Asset type: production app launcher brand mark for ZippyGo Motoboy, a Brazilian motorcycle delivery app.
Input image 1 is STYLE AND IDENTITY REFERENCE ONLY: the approved ZippyGo ivory helmet with dark visor and electric blue edging. Create a NEW distilled launcher emblem inspired by it, not a literal photo crop.
Primary request: one exceptionally polished, instantly recognizable stylized 3D full-face motorcycle helmet mark on a genuinely transparent background. Use the reference's three-quarter orientation facing right. Reduce its construction to bold flowing sculpted shapes that stay clear at 32–48 pixels: smooth pearl-white shell, one large deep midnight-blue glossy visor, clean cobalt-blue curved rim and a small blue hinge. Subtle satin bevels, tasteful studio highlights and blue reflected light. Modern confident silhouette, friendly premium product design; no clutter.
Composition: square canvas, single isolated helmet exactly centered, entire helmet visible without cropping; silhouette spans about 72% of canvas width and height, with balanced transparent breathing room on every side. Designed to be placed over a solid royal blue or midnight navy app-icon background and inside circle and squircle masks. Lighting integrated into the object only; no cast shadow extending far outside silhouette.
Constraints: REAL transparent alpha background, no white background, no colored tile, no circle, no rounded-square enclosure, no mockup, no scenery, no multiple variants, no lettering, no watermark, no extra objects, no decorative sparkles. Avoid the reference's fine vents, mesh texture and copper mechanical detail. Preserve the helmet identity and blue visual language, with icon clarity rather than photographic complexity.
```

## Validação

- Configuração Expo efetiva verificada: ícone, foreground, favicon, cores e largura de abertura.
- `icon.png` exportado em RGB, sem alpha; favicon opaco. Arte-mestra e foreground com transparência real.
- Foreground com raio de pixels visíveis de 305,4 px, dentro do limite seguro de 312,9 px (66 dp em canvas de 108 dp).
- Verificadas as dimensões dos 20 derivados: launcher 48/72/96/144/192 px, foreground 108/162/216/324/432 px e abertura 288/432/576/864/1152 px.
- Prévia renderizada e inspecionada no Chrome: quadrado, máscara circular adaptativa, 64/48/32 px e abertura. Captura local em `C:/Users/farle/.codex/tmp/zippy-brand-preview/icone.png`.
- `:app:processDebugResources` passou após a geração final: **BUILD SUCCESSFUL em 39 s, 263 tarefas**. Log em `android/build-brand-resources.log`. Sintaxe do gerador e `git diff --check` passaram.
- Não houve reinstalação nem inspeção em aparelho (`adb devices` vazio). A prévia HTML confere os assets, mas a apresentação final do launcher/splash depende do aparelho. Não foi compilado iOS.
