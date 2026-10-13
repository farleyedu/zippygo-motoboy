# Ofertas prioritárias — decisões e validação

O pedido novo exige a atenção do motoboy e uma resposta explícita. A implementação separa oferta do servidor, janela dentro do app e aviso do sistema. Receber, abrir ou ocultar um aviso nunca aceita pedidos, troca os destinos da navegação ou registra entrega.

| Situação | Comportamento |
| --- | --- |
| App aberto, inclusive chat ou rota | A oferta abre sobre a tarefa atual. Mapa, conversa e rascunho são preservados; o teclado é recolhido. |
| Ocultar durante rota | Fecha a janela e mantém o acesso no painel da rota, com o mesmo prazo e seleção. Aviso do sistema permanece na lista; um aviso atrasado da mesma oferta não gera outro banner/som enquanto ela estiver ocultada e o app ativo. |
| Outra oferta chega | Nova identidade abre a janela novamente. Ocultar uma oferta não pausa chamados. |
| Toque em aviso de oferta já carregada | Reabre imediatamente, sem esperar uma consulta à API. |
| Toque com oferta ainda não carregada e falha de rede | Não consome a resposta do aviso. A retomada em primeiro plano tenta novamente. |
| GPS revogado durante turno | Mantém sessão, heartbeat e sincronização de ofertas. Aceite/recusa ficam disponíveis; movimentação continua com suas validações. O GPS não é inventado nem marcado como atual. |
| Conclusão de entrega pendente | Mostra a oferta, permite ocultar e oferece sincronização. Resposta fica bloqueada até resolver a conclusão, conservando a regra existente. |
| Aceite parcial | Confirma quais pedidos entram e quais são recusados. Envia identidade da oferta e versão da fila. |
| Oferta respondida/retirada conhecida ou vencida | Fecha o aviso correspondente na lista do sistema quando o app está ativo ou retorna. Um aviso futuro desconhecido não é apagado apenas porque chegou antes da fila. |
| Oferta vencida, payload inválido ou outro turno | Não abre uma oferta nem executa uma resposta. O servidor valida prazo e contexto novamente no aceite. |

Ocultar não renova nem pausa o prazo: se ele acabar, valem as ações de expiração do servidor. Não foi criado aceite automático ou mudança nas regras de distribuição/transferência. Dentro do app, a janela independe da permissão de notificações do aparelho. Fora dele, a entrega passa por Expo/FCM/APNs ou Web Push e pela permissão do sistema; não há comprovação de recebimento pelo usuário apenas por um ticket HTTP.

## Entrega e concorrência

Android usa prioridade alta, canais próprios e identificadores de colapso/substituição por oferta. A inscrição está vinculada ao turno. Há um aviso local de apoio para ofertas obtidas pela fila; depois das consultas às permissões/canais, ele confere novamente sessão, identidade e prazo para não anunciar uma oferta encerrada nesse intervalo.

O handler nativo não espera rede ou armazenamento. Reserva a identidade em memória, responde ao sistema e só confirma o registro de apresentação no callback de sucesso. Erro/timeout libera a reserva para nova tentativa. A persistência ocorre depois e em ordem por sessão; uma gravação antiga não sobrescreve a confirmação mais recente. Isso evita perder um aviso por marcar “exibido” antes da apresentação.

O pacote Expo instalado exige resposta do handler em três segundos e pode descartar o aviso em caso de atraso. Identificadores dos callbacks foram conferidos nos fontes Android e iOS instalados. Referências públicas: [handler Expo](https://docs.expo.dev/versions/latest/sdk/notifications/#setnotificationhandlerhandler), [entrega, prioridades, canais e recibos](https://docs.expo.dev/push-notifications/sending-notifications/).

Na web, reenvios da mesma tag substituem o aviso sem repetir alerta (`renotify: false`). A notificação fica separada do diálogo da página. Clique reabre a oferta sobre a tarefa atual, com validação de turno e prazo; abertura a frio retoma o app. Web Push de ofertas exige as variáveis VAPID do backend e a instalação/permissão no iPhone: [configuração](../../motoboyBackEnd/docs/DISPONIBILIDADE-E-OFERTAS.md).

## Verificação

- `node --test docs/validacao-etapa2/lote3/session-tests.cjs docs/validacao-modo-rota/navigation-tests.cjs docs/validacao-web-ios/offer-push-tests.cjs docs/validacao-web-ios/offer-attention-tests.cjs`: 63 testes passaram. Incluem armazenamento travado, aviso concorrente, erro/timeout de apresentação, ordenação de gravações, falha de rede, expiração durante consulta, mudança de sessão, ocultar e GPS revogado.
- TypeScript e export web de produção passaram. Os 36 cenários por motor Chromium/WebKit passaram em ambos os temas, incluindo reabertura com seleção preservada, mapa sem remontar, aceite parcial e prazo que continua diminuindo depois de ocultar e atualizar a fila. O servidor controlado conserva a data original de vencimento, sem recriá-la a cada consulta.
- Testes da API relacionados à disponibilidade/envio: 78 passaram com PostgreSQL local isolado, conforme [relatório backend](../../motoboyBackEnd/docs/DISPONIBILIDADE-E-OFERTAS.md). O teste de HTTP criptografado não comprova recebimento no telefone.

Roteiro físico após instalar o novo APK: ofertar com app aberto e em rota; ocultar/reabrir sem responder; testar uma segunda oferta, recusa e aceite parcial; repetir com outro app aberto/tela bloqueada; confirmar retomada do mesmo turno. Fazer isso em ambiente de teste, sem criar entregas reais pela validação automatizada. Navegação SDK e entrega de push no aparelho continuam pendentes de homologação. Capturas temporárias usadas nesta revisão foram apagadas.

Build Android `preview` concluído com sucesso em 11/10/2026: [419e8012-6d80-4417-a9cf-f7eef3eab8ce](https://expo.dev/accounts/farleyedu/projects/zippygo-motoboy/builds/419e8012-6d80-4417-a9cf-f7eef3eab8ce). APK baixado e conferido, incluindo Firebase; cópia compatível com a assinatura local anterior em Downloads: [APK-ANDROID.md](APK-ANDROID.md). Não instalado, sem aparelho conectado. A atualização do backend/migrations ainda é necessária para disponibilidade persistente em produção.
