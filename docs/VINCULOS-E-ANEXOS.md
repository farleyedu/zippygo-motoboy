# Acesso sem vínculo, convites e anexos — 12/10/2026

O login do zippyBoy permite entrar na conta mesmo sem estabelecimento vinculado. A API emite o acesso da conta sem contexto de loja; a seleção e o início do turno continuam exigindo vínculo aprovado. A renovação também funciona sem vínculo, inclusive quando existe uma seleção antiga de loja.

O início sem vínculo mostra um cartão grande **Solicitar vínculo**, com o mesmo cartão azul, capacete, tipografia Manrope, temas e navegação do projeto. A busca apresenta os estabelecimentos ativos disponíveis para DELIVERY, permite filtrar por nome/cidade e acompanha pedidos pendentes, recusados ou aprovados. **Convites e vínculos** abre os convites enviados pela loja, permitindo aceitar ou recusar antes de qualquer turno.

O fluxo de aviso à loja e aprovação/recusa já existia: a API publica `motoboy.link.requested`, e o painel trata solicitações na aba Motoboys e em Configurações → Equipe. A aprovação efetiva é necessária para selecionar a loja.

## Áudios e fotos

- **Causa reproduzida no Android:** o Blob/FileReader transformava o tipo de áudio/foto em `application/octet-stream`; `openChatFile` recusava esse formato genérico. O Data URL agora conserva o `Content-Type` recebido da API, mantendo a extensão e os bytes corretos.
- Play/pausa respondem ao toque durante o preparo. O player começa com um toque, sem depender de um novo evento `isLoaded`; um segundo toque cancela/pausa. O ícone deixa de ser substituído por uma rodinha e os alvos de toque têm pelo menos 48 px.
- O player trata erros nativos do Android e descarta a fonte que falhou. Uma nova tentativa baixa o anexo novamente.
- Fotos com falha de download ou decodificação oferecem nova tentativa.
- O download rejeita respostas HTTP sem sucesso e arquivos vazios. O envio também rejeita arquivos vazios.
- Uma falha ao salvar a gravação na fila não descarta sua prévia. Depois de entrar na fila, o anexo permanece na outbox até a confirmação do envio, inclusive após falhas de upload/rede.
- A gravação interrompe a reprodução anterior, restaura o modo de áudio ao sair para segundo plano e evita várias finalizações automáticas ao alcançar o limite.
- A API converte OGG/WebM/WAV recebidos do cliente para AAC/M4A, usando o conversor existente. Isso completa o caminho que já era aplicado aos áudios enviados pela loja e pelo motoboy. O ambiente da API precisa do FFmpeg previsto no Dockerfile.

## Verificação

- TypeScript sem erros.
- Bundle Android/Hermes exportado com sucesso em `.expo/validation-native-link-media`; isso verifica empacotamento, sem substituir instalação de APK e teste no aparelho.
- `link-request-tests.cjs`: 14 cenários no app Web real com API interceptada, incluindo login/restauração sem vínculo, senha inválida, solicitações, vínculo ativo exigido, aceitar e recusar convite; claro/escuro e 320/390 px. Após ajustar a ilustração em telas estreitas, o percurso de solicitação foi repetido nos dois temas.
- Revisão visual da tela inicial contra o HTML original do projeto nos mesmos temas e larguras. O estado sem vínculo é uma extensão solicitada pelo usuário; não é uma tela idêntica do protótipo. As capturas de revisão são temporárias.
- `chat-media-domain-tests.cjs`: nove cenários com os módulos reais e transporte/armazenamento/player controlados, incluindo Blob genérico do Android, toque único antes de `isLoaded`, cancelamento durante o preparo, bytes, endpoints, multipart, destinatário, erro nativo, foto e prévia da gravação.
- `chat-bubbles-tests.cjs`: dez cenários no Chromium, incluindo reprodução de WAV real, pausa, velocidade e exclusividade entre mensagens nos chats da loja e do cliente.
- `docs/validacao-etapa5/domain-tests.cjs`: 14 cenários da outbox e avisos, incluindo falhas de armazenamento, reenvio sem repetir upload e isolamento de conta/turno.
- Backend: 40 testes unitários e dez integrações passaram. PostgreSQL 16 local no WSL, role temporária e schemas isolados; nenhuma integração ignorada na execução final. Inclui login/refresh sem vínculo, seleção antiga, aprovação, revogação, sessões e anexos. Role removida e cluster parado após os testes.

## Validação no Android conectado

Xiaomi `25078PC3EG` conectado pelo usuário. Primeiro reproduzidos os erros de abertura de áudio e foto. A entrada de QA usa `ChatMedia`, `AudioComposer`, `retainChatFile`, `uploadChat` e `sendChat` reais, servidos exclusivamente por uma fixture local via `adb reverse`; sem conversa nem envio de produção.

Após a correção de MIME, foto de 487.761 bytes abriu; WAV recebido de 384.044 bytes reproduziu; gravação AAC/M4A de 77.378 bytes fez upload, envio e download e reproduziu no celular. O usuário confirmou que os dois áudios tocaram. O sistema Android registrou os dois `AudioTrack`, sem mute, com saída pelo alto-falante. Depois do ajuste de usabilidade, quatro ciclos consecutivos iniciaram e pausaram com um toque cada; resultados em `.expo/validation-chat-media/native-control-results.json`.

O APK completo foi instalado com `adb install -r`, preservando os dados, e aberto novamente. A tela de QA não está no pacote entregue. Arquivo: `C:/Users/farle/Downloads/ZippyBoy-vinculos-audios-2026-10-12.apk`, também em `.expo/field-apk/`; 76.917.887 bytes, SHA-256 `745f72a31677598601b9dfd90c0b6e2a0345da5bc23d2d21f29ad010e394a046`. Assinatura e alinhamento ZIP de 16 KiB conferidos; bundle final comparado byte a byte e sem endpoint/entrada de QA.

**Publicação da API ainda pendente.** No celular, o serviço público ainda respondeu que a conta sem vínculo não podia entrar. O APK corrige áudio, fotos e controles; o login sem vínculo e a conversão adicional do áudio recebido do cliente dependem de publicar o backend atualizado. Nenhum commit, push ou deploy nesta rodada.
