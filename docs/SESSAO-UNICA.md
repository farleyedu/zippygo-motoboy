# Confirmação de sessão ativa — 10/10/2026

Pedido de Farley: ao entrar em uma conta já usada em outro aparelho, avisar antes de substituir a sessão. **Cancelar** mantém o outro acesso. **Continuar** confirma o encerramento da sessão anterior e do turno online; os pedidos permanecem no servidor.

## Comportamento implementado

- Login envia a identificação persistida do aparelho. A confirmação inclui o ID da sessão que o usuário viu no aviso.
- HTTP 409 `LOGIN_SESSION_ACTIVE` abre o aviso sem gravar uma autenticação nova nem navegar para o turno.
- Se a sessão mudar antes da confirmação, o app apresenta o aviso novamente com a sessão atual. Falha de rede permite tentar novamente.
- O backend vincula login, seleção do restaurante e renovação à mesma sessão. Após substituição, recusa as credenciais anteriores, inclusive refreshs recém-rotacionados.
- O app verifica o login a cada 30 segundos enquanto está aberto e ao voltar para o primeiro plano. Sem internet, a tela anterior pode continuar visível até uma nova conexão; o servidor já recusa o acesso revogado.
- Login e início de turno usam o mesmo bloqueio por usuário. Um início ou logout atrasado do aparelho anterior não encerra nem cria um turno depois da troca.
- A nova sessão ainda passa pela preparação de permissões antes de ficar online.

O controle de login aplica-se ao app que envia `clientApp: motoboy`. O painel mantém seu contrato. Para saída completa e verificação periódica nos dois aparelhos, atualizar o app e fazer um novo login em ambos. Para uma versão anterior sem sessão de login identificada, o backend reconhece o turno ativo e pede confirmação; encerra esse turno e revoga a renovação antiga. A versão anterior não tem a nova verificação periódica de login.

## Pacote e validação

Novo APK: `.expo/field-apk/ZippyGo-sessao-2026-10-10.apk`, também em `C:/Users/farle/Downloads/` e em Downloads do celular. **Instalação de atualização por ADB: Success.** App abriu a frio em 2.746 ms, processo permaneceu ativo e os logs coletados não mostraram erro fatal nem exceção JavaScript. Dados locais preservados pela instalação com `-r`.

- Release ARM64; 74.893.265 bytes; API HTTPS de produção; sem Metro ou Expo Go.
- SHA-256: `a5822403d166de6a0e1f4372538d6bc98cc09c74103ccd8ebe769636ab35dc29`, igual no computador e na cópia no celular.
- Assinatura, alinhamento ZIP, arquitetura e bundle Hermes com contrato de confirmação e `/auth/session` conferidos. Build final: **1m47s / 908 tarefas**.
- TypeScript: passou. Domínio mobile: **90 testes passaram**.
- UI Web com API interceptada: **6 cenários passaram**, claro e escuro, sem erro JavaScript. Cancelamento, confirmação, mudança de sessão, falha de rede e saída do aparelho substituído. Capturas em `.expo/validation-login-session/`.
- Backend: **25 testes passaram**, incluindo **4 com PostgreSQL local real**. Conferidos login, seleção, refresh, credenciais antigas recusadas, logout atrasado e duas confirmações concorrentes (uma vence; a outra precisa confirmar a sessão nova).

Para executar a revisão Web, exportar o app e servir o diretório local; depois executar `docs/validacao-etapa2/lote3/login-session-tests.cjs` com `QA_BASE_URL` e `QA_PLAYWRIGHT_MODULE`. A revisão visual usa o padrão de overlay do HTML aprovado e os componentes existentes; não encerra a divergência anterior da composição completa do login. O diálogo nativo com uma conta real em conflito ainda precisa de conferência.

## Publicação pendente

Durante a execução, o backend foi commitado/enviado externamente como `1030997` (`ajuste seção`). O agente não executou commit ou push. As correções finais de concorrência, logout e os testes permanecem locais. Na última consulta, o Swagger do Render respondeu 200 e ainda não expôs `GET /api/auth/session`: a publicação da API atualizada não foi comprovada.

Para ativar o recurso em produção, publicar o backend completo e aplicar `20261010_03_motoboy_login_sessions.sql` (incluída no conjunto de migrations de inicialização). Detalhes: [SESSAO-UNICA-MOTOBOY.md](../../motoboyBackEnd/docs/SESSAO-UNICA-MOTOBOY.md).

Login real em dois aparelhos, GPS em movimento e comportamento com bateria/segundo plano permanecem para o teste de campo. Os testes usaram contas de QA e schema isolado no PostgreSQL 16 instalado no Ubuntu 24.04/WSL; nenhuma conta de produção foi substituída.

Após a validação, encerrados o servidor Web de QA e o PostgreSQL local; removida a role temporária de teste e configurado o cluster instalado para início manual. Os schemas de teste foram removidos pelas fixtures. Os pacotes PostgreSQL permanecem instalados no WSL para futuras verificações.
