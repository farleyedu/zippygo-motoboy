# Imagens do ZippyBoy para o Google Play

Arquivos preparados em 13/10/2026. O nome **ZippyBoy** segue a página da loja enviada pelo Farley; a identidade visual é a mesma do app ZippyGo Motoboy.

## Arquivos para enviar

| Campo do Play Console | Arquivo | Dimensões |
| --- | --- | --- |
| Ícone do aplicativo | [icone-512.png](imagens/icone-512.png) | 512 × 512 px |
| Recurso gráfico | [banner-1024x500.png](imagens/banner-1024x500.png) | 1024 × 500 px |
| Capturas de tela do telefone — 1 | [Conferência da entrega](imagens/01-conferencia-entrega.png) | 900 × 1600 px |
| Capturas de tela do telefone — 2 | [Mapa e rota](imagens/02-mapa.png) | 900 × 1600 px |
| Capturas de tela do telefone — 3 | [Ganhos](imagens/03-ganhos.png) | 900 × 1600 px |

[Baixar todas as sete imagens em ZIP](zippyboy-google-play.zip). As duas logos adicionais estão incluídas no ZIP; seus arquivos de upload são o ícone, o banner e as três capturas indicadas acima.

O vídeo promocional da página da loja é opcional. A declaração de localização em segundo plano exige um vídeo próprio; veja o [roteiro e a validação do consentimento](LOCALIZACAO.md). As três capturas foram obtidas diretamente no celular Android conectado, com o app instalado, versão 1.0.0. O conteúdo visível no aparelho foi preservado. Veja as [exigências oficiais de recursos visuais do Google Play](https://support.google.com/googleplay/android-developer/answer/9866151?hl=pt-BR).

## Logo

- [Logo com fundo azul — 1024 × 1024 px](imagens/logo-1024.png): arquivo original do ícone em alta resolução.
- [Logo transparente — 1254 × 1254 px](imagens/logo-transparente.png): arte-mestra do capacete, com transparência real, para apresentações e materiais da marca.

O ícone de 512 px é o arquivo para o campo **Ícone do aplicativo**. As duas logos em alta resolução são materiais adicionais.

## Prévia

![Recurso gráfico do ZippyBoy](imagens/banner-1024x500.png)

![Ícone do ZippyBoy](imagens/icone-512.png)

### Capturas do aplicativo

![Conferência da entrega](imagens/01-conferencia-entrega.png)

![Mapa e rota](imagens/02-mapa.png)

![Ganhos](imagens/03-ganhos.png)

## Origem e reprodução

As artes reutilizam `assets/images/icon.png`, `splash-icon.png` e `capacete-3d-azul.png`, já aprovados no projeto. A fonte é a Manrope instalada no app. Não foram alterados os recursos de instalação, o nome interno nem as telas do aplicativo.

O banner é uma composição HTML/CSS em [artes/banner.html](artes/banner.html). O [gerador](gerar-artes.cjs) exporta a composição em PNG RGB sem transparência e dimensiona o ícone para 512 px. Usa as dependências instaladas do Expo e o Playwright disponível no ambiente. Na raiz do app:

```powershell
$env:NODE_PATH = 'C:/Users/farle/.codex/tmp/zippy-prototype-review/node_modules'
node docs/google-play/gerar-artes.cjs
```

Os arquivos em `imagens/` são entregáveis da página da loja e devem ser preservados.

## Capturar no celular

O roteiro [capturar-android.cjs](capturar-android.cjs) usa ADB no aparelho escolhido. O celular precisa estar desbloqueado, com o app aberto. O roteiro não instala aplicativos, não muda a resolução e não envia mensagens.

```powershell
# Consulte o serial com adb devices e escolha o aparelho desejado.
$env:PLAY_DEVICE_SERIAL = 'SERIAL_DO_CELULAR'
node docs/google-play/capturar-android.cjs capture 01-inicio
```

A captura integral fica em `originais/`. O gerador exporta a versão de upload em `imagens/`, acrescentando margens laterais quando necessário para chegar à proporção 9:16. A interface original permanece inteira, sem corte nem ampliação. No aparelho conectado nesta preparação, a tela tem 720 × 1600 px e a exportação terá 900 × 1600 px.

As dimensões atendem ao requisito de publicação. Para oportunidades de promoção que exigem quatro imagens com largura mínima de 1080 px, serão necessárias capturas de um aparelho ou emulador com resolução maior.
