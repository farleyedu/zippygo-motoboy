# Pendências para depois do visual

Atualizado em 07/10/2026. Este documento não autoriza alterações no backend. O trabalho atual usa os contratos existentes; endpoints administrativos não devem ser usados para contornar permissões do motoboy.

| Pendência | Trabalho futuro / critério |
| --- | --- |
| Validação antecipada de código | Contrato dedicado, sem concluir a entrega; não validar localmente nem expor o código secreto. |
| Cobrança e divisão | Registro explícito e transacional com a entrega, totais, troco, divergências e conciliação. Abrir a tela ou selecionar método não registra recebimento. |
| Comprovante | Confirmar upload autorizado, associação ao pedido, política, acesso e retenção. |
| Finalização sem rede | Idempotência e reconciliação com pedido/versão; pendência não libera a próxima entrega. |
| Chat privado e mídia | Conversa entre colegas, áudio/imagem, respostas/reações, paginação, leitura, envio pendente e retry conforme contratos autorizados. |
| Histórico, ganhos e acerto | Consulta do próprio motoboy, taxas e valores reais, recibos, divergências e confirmação pelas partes. Taxa de entrega não equivale ao ganho. |
| Perfil, veículo, documentos e recuperação | Auditar contratos do próprio usuário antes da etapa correspondente; não reutilizar permissões administrativas. |
| Recuperação de senha — lote 2.1 | Inspeção de AuthController, IAuthService e buscas no checkout não encontraram solicitação/redefinição de senha. Tela nativa apresenta indisponibilidade e envio desabilitado, sem coletar e-mail. Futuro contrato deve enviar instruções e redefinir com token temporário, sem revelar se o e-mail existe. |
| Segurança e notificações | Confirmar serviços reais de aviso, contatos de confiança, push e leitura persistida. Não mostrar SOS enviado sem confirmação. |
| Operação | Conferência de volumes, pausa e bloqueios de fechamento precisam seguir as políticas efetivamente existentes. |
| Troca de estabelecimento — lote 2.2 | `auth/definir-estabelecimento` valida vínculo/loja, mas não consulta sessão ou fila operacional ativa. App bloqueia troca quando há contexto operacional local. Futuro controle no servidor deve impedir troca concorrente com operação ativa, inclusive em outro aparelho; bloqueio visual/local não comprova essa garantia. |

Já confirmados no checkout atual: consulta operacional detalhada com fotos, proteção `expectedPedidoId` na chegada, canal/leitura do cliente e contatos. Esses itens não são pendências de criação de endpoint. A disponibilidade no ambiente implantado ainda deve ser verificada com API de teste.

Registrar novos bloqueios a cada lote com a tela afetada, contrato ausente/incompleto e critério de aceite, mantendo o backend sem alterações durante esta fase.
