# QA de conta, turno, rota e finalização

08/10/2026. O roteiro executa o bundle Expo real no Chrome, intercepta API e WebSocket e bloqueia chamadas externas. Usuário `qa34`, pedidos 23/24, valores e fotos são fixtures; não há operação de produção. PostgreSQL/backend são validados separadamente.

## Executar

Na raiz mobile:

```powershell
node --test docs/validacao-etapa2/lote3/sync-tests.cjs docs/validacao-etapa2/etapa34/completion-tests.cjs
npx tsc --noEmit
npx expo export --platform web --output-dir .expo/validation-etapa34/web
$env:QA_OUTPUT='../../.expo/validation-etapa34/web'
$env:QA_PORT='8196'
node docs/validacao-etapa2/servir.cjs
```

Em outro terminal:

```powershell
# Playwright é ferramenta de revisão; não é dependência do app.
$env:QA_PLAYWRIGHT_MODULE='C:/Users/farle/.codex/tmp/zippy-prototype-review/node_modules/playwright'
$env:QA_BASE_URL='http://127.0.0.1:8196'
node docs/validacao-etapa2/etapa34/original.cjs
node docs/validacao-etapa2/etapa34/revisar.cjs
```

O caminho Playwright pode ser substituído por uma instalação disponível. Chrome esperado: `C:/Program Files/Google/Chrome/Application/chrome.exe`. Encerre apenas o servidor de QA iniciado por você ao terminar; preserve o Metro do usuário.

## Cobertura e evidências

`original.cjs` lê o HTML aprovado, captura 12 composições em ambos os temas e extrai CSS efetivo; não escreve na referência. `revisar.cjs` navega 25 rotas em claro/escuro e oito telas críticas em 320 px. Testa código incorreto/correto e não editável, dinheiro insuficiente/troco, divisão com dois recebimentos, galeria/upload/revisão privada, toque/arraste parcial, arraste completo com ACK perdido, recuperação e reenvio idêntico, próximo pedido pago e bloqueio de logout em pendência.

Capturas e resultado da execução ficam em `.expo/validation-etapa34/`, ignorado pelo Git. `resultado.json` nesta pasta documenta a última execução concluída e deve ser atualizado depois do roteiro passar. Métricas CSS originais ficam em `original-metricas.json` no diretório ignorado. As capturas Web não são aprovação visual Android: o HTML contém status bar/safe area ilustrativos e o Web não executa GPS/background, câmera nativa ou toque real.

O roteiro também verifica registro local ilegível: preserva os dados/token e bloqueia nova conferência/logout. A leitura assíncrona do SecureStore depende ainda de teste de retomada Android.

90 execuções de domínio, com 22 casos de sessão carregados nos dois arquivos; 68 casos distintos. Backend: 949 testes, 23 PostgreSQL local, nenhum ignorado. Admin: TypeScript e 12 verificações. APK Android compilado/instalado com image-picker; as novas telas ainda não foram conferidas no emulador. A revisão automática rejeitou trocar o servidor de desenvolvimento/inspecionar conexão, retornando somente `blocked by policy`.

Detalhes, contratos, limites e próximos testes: [ETAPA-3-4.md](../../prototipo-motoboy/ETAPA-3-4.md).
