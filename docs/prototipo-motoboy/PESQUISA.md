# Pesquisa de mercado e oportunidade do ZippyGo

Pesquisa em fontes oficiais consultadas em 06/10/2026. Recursos variam por região e não são promessas de disponibilidade no Brasil. As decisões abaixo são inferências de design para o ZippyGo, não resultados de entrevistas com entregadores.

| Referência | Observação documentada | Decisão proposta para ZippyGo |
|---|---|---|
| [iFood — Rota de ponta a ponta](https://entregador.ifood.com.br/rota-de-ponta-a-ponta/) | Etapas de coleta/entrega, códigos, bag, cliente não localizado e loja fechada possuem caminhos próprios. | Bag/checklist, confirmação por etapas e imprevistos acessíveis no contexto do pedido. |
| [iFood — Jeito iFood de entregar](https://entregador.ifood.com.br/jeito-ifood-de-entregar/) | Autenticação e procedimentos de entrega e cobrança estão associados ao canal e à operação. | Não usar uma regra universal: exibir requisitos do pedido e estado do canal antes de pedir ação. |
| [DoorDash — Guia do Dasher](https://dasher.doordash.com/en-ca/blog/how-to-use-dasher-app) | Guia de 20/08/2026 organiza ofertas, navegação, retirada, prova fotográfica, ganhos, conta e ferramentas de segurança. | Oferta legível; jornada conectada; recibo; ganhos transparentes; segurança próxima do mapa. Contexto Canadá/EUA. |
| [Uber — Ganhos de entregadores](https://www.uber.com/us/en/deliver/earnings/) | Apresenta ganhos, áreas de demanda e oportunidades disponíveis em seu mercado. | Motoboy precisa entender o que ganhou e o que carrega para a loja. Não importar mapa de demanda sem dados locais. Contexto EUA. |
| [Uber — Safety Toolkit](https://www.uber.com/pk/en/newsroom/new-safety-toolkit-arrives-pakistan/) | Referência histórica regional de segurança centralizada no mapa e proteção de dados após a viagem. | Central de segurança sempre acessível e histórico sem endereço completo. Fonte de 2018, contexto Paquistão; inspiração, não evidência de oferta atual no Brasil. |

O portal iFood bloqueou a abertura direta automatizada (403); a pesquisa usou os trechos indexados da página oficial. As páginas DoorDash e Uber Ganhos puderam ser abertas. Não foi feita pesquisa com usuários, teste de campo nem comparação de avaliações nas lojas de apps.

## Diferenciais que fazem sentido para esta operação

1. **O turno como unidade de trabalho.** O app informa loja ativa, localização compartilhada, fila, dinheiro da loja, ganhos e pendências até o fechamento.
2. **Chat operacional contextual.** Loja, cliente, colegas e grupo reunidos, com pedido preso à conversa e ação para voltar à rota. Grupo não altera logística. Canal indisponível tem alternativa clara.
3. **Finalização que evita erro.** Código, recebimento, troco e comprovante apresentados como conferências progressivas. Um único arraste efetiva o resultado. Recibo mostra o que foi registrado.
4. **Rastreamento transparente.** Motoboy vê quem acompanha, último envio, precisão e estados de sincronização. A loja acompanha desde que está online; cliente tem autorização independente.
5. **Coleta com conferência.** Identificação visual de cada pedido, quantidade de volumes, observações de embalagem e estado em preparo. Evita sair com pedido trocado ou incompleto.
6. **Resiliência visível.** Sem internet não vira entrega ficticiamente confirmada. Fila pendente e recuperação de sessão têm telas reais e não um aviso genérico.
7. **Acerto com duas contas.** Ganho do motoboy separado de dinheiro recebido dos clientes e pertencente ao estabelecimento. Ajuste contestável e recibo de turno.
8. **Beleza com função.** Luz sinaliza presença e prontidão; camadas mostram sequência; animação mostra transição; relevo reforça o gesto crítico de conclusão.

## Prioridades sugeridas

**Primeira entrega de produto:** fluxos existentes completos, online/GPS robustos, mapas/rota, mensagens loja/grupo/cliente permitido, confirmação correta, conflitos, cancelamento, retorno e permissões.

**Segunda:** chat direto com colegas, anexos/áudio/resposta/reação, coleta enriquecida, comprovante por política e histórico/acerto com contratos definidos.

**Terceira:** contatos de confiança, acessibilidade ampliada, métricas de qualidade sem incentivo à pressa, diagnóstico avançado, sugestão de sequência e documentos conforme necessidade da operação.

Não priorizar agora: rede social pública, ranking por velocidade, marketplace paralelo, carteira bancária própria ou navegação GPS própria sem necessidade. Acrescentam custo e não resolvem primeiro a coordenação entre loja e motoboy.

## Perguntas para validar depois do protótipo

- Quem define taxa/repasse? Por pedido, km, turno ou contrato?
- O motoboy pode transferir diretamente ou só pedir aprovação?
- Código é verificado só em entrega ou há validação separada autorizada?
- Há pagamento parcial/estorno autorizado e qual sistema é responsável pelo registro?
- Quais canais permitem conversa bidirecional real com o cliente?
- Foto de entrega é necessária para quais pedidos e por quanto tempo fica armazenada?
- Pausa/troca de loja/fechamento têm quais bloqueios operacionais?
- Que funções continuam disponíveis sem rede e como é confirmada a sincronização?

Essas perguntas estão registradas para a implementação; não impedem revisar as telas com dados fictícios agora.
