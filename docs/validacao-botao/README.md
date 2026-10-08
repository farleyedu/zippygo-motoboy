# Correção do botão — 07/10/2026

O gradiente do botão primário ficava cortado no Android. O SVG usava largura/altura em porcentagem diretamente dentro de um `Pressable` com padding. A correção mede um contêiner absoluto que ocupa a caixa inteira e passa dimensões numéricas ao SVG.

Referência: tela `login` de [prototype.js](../prototipo-motoboy/prototype.js) e CSS efetivo de [styles.css](../prototipo-motoboy/styles.css). O HTML aprovado não foi alterado. `resultado.json` registra os hashes desses arquivos usados na comparação.

O componente reutiliza o gradiente azul a 125°, altura mínima de 50, raio 15, padding 12/17, texto 12, ícone 18, sombra por tema, borda do tema escuro e reflexo com ciclo de 7 s. O toque usa escala .98; movimento reduzido e bloqueio suspendem o reflexo. A fonte `Manrope-ExtraBold.ttf` foi extraída no peso 800 da Manrope já existente, com licença OFL preservada. O arquivo variável tinha eixo padrão no peso 200; o botão agora escolhe o peso explicitamente no Android.

## Evidências

Comparação direta: [botão original escuro](botao-original-escuro-390.png), [botão no app Web](botao-app-web-escuro-390.png) e [tela no Android](android-escuro.png).

- `original-*.png`: captura do HTML original com somente a moldura externa removida, nos temas claro/escuro e larguras 390/320. Não são recriações do design.
- `app-web-*.png` e `botao-app-web-*.png`: capturas da implementação nos mesmos temas/larguras. O roteiro confere medidas contra o original e cobertura integral do fundo; essas capturas não são uma nova referência aprovada.
- `botao-reflexo-web.png` e `botao-carregando-web.png`: passagem do reflexo e carregamento com bloqueio de envio duplicado, usando API interceptada.
- `android-escuro.png` e `android-validacao-local.png`: emulador Android API 36, tela física 1080×2400, densidade 420. Botão sem faixa cortada; toque com formulário vazio mostra os dois erros locais. Nenhum login foi enviado pelo teste nativo. O acesso já existente não foi apagado.

A revisão nativa desta correção cobre o tema escuro no emulador disponível. Claro e movimento reduzido foram conferidos no Web; iOS e Android claro não foram verificados nesta rodada.

TypeScript, exportação estática e diff passaram. Os cenários funcionais dos lotes 2.1 e 2.2 também passaram após a mudança das camadas do botão: seis grupos em cada roteiro, sem erros JavaScript. A revisão própria do botão está em `resultado.json`.

**A fidelidade da tela inteira de login continua pendente.** A comparação deixa visíveis diferenças de composição, respiro, cabeçalho, ícone com profundidade, cores gerais, tipografia dos demais textos, linha lembrar acesso/recuperação e rodapé. O botão corrigido não autoriza declarar a tela inteira concluída.

## Reproduzir

Na raiz do mobile:

```powershell
npx tsc --noEmit
npx expo export --platform web --output-dir docs/validacao-etapa2/lote3/bundle
$env:QA_OUTPUT = 'lote3/bundle'
$env:QA_PORT = '8193'
node docs/validacao-etapa2/servir.cjs
```

Em outro terminal, informar uma instalação local de Playwright; ela não é uma dependência de produção:

```powershell
$env:QA_PLAYWRIGHT_MODULE = 'caminho/para/node_modules/playwright'
$env:QA_BASE_URL = 'http://127.0.0.1:8193'
node docs/validacao-botao/revisar.cjs
```

O roteiro bloqueia chamadas externas e intercepta a API com dados fictícios. Usar as capturas para comparar com o original; os checks automatizados não aprovam sozinhos a fidelidade visual.
