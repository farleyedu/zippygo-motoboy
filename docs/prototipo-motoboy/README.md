# ZippyGo — Seu próximo movimento

**61 telas em um protótipo navegável**, com identidade nova, mapas em perspectiva, cartões com reflexos, animações de estado, chat contextual e conferência de entrega por arraste. Criado em 06–07/10/2026 para revisar o design do futuro app do motoboy.

Paleta revista em 07/10 a pedido do Farley: **azul vivo, branco luminoso, azul profundo e detalhes em cobre**. O tema noturno também usa a nova identidade. A mudança alcança botões, cartões, mapas, conversas, ícones, reflexos e capacete 3D. Verde fica reservado à confirmação de código, conforme a regra de negócio.

## Abrir no Chrome

Abra `index.html` com o Chrome por duplo clique ou arraste o arquivo para uma janela do navegador. Mantenha `styles.css`, `prototype.js` e `assets/` junto dele. **Não precisa instalar nada, iniciar o Expo, rodar servidor ou ter internet.**

Se preferir, execute no PowerShell:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' 'C:\Users\farle\TI\Zippy\zippygo-motoboy\docs\prototipo-motoboy\index.html'
```

## Explorar

- **Protótipo:** celular interativo, índice de telas e painel com propósito, caminhos e cenários.
- **Todas as telas:** galeria das 61 composições; filtre por capítulo e clique para abrir uma tela.
- **Fluxos:** jornada do turno, conferências e caminhos de recuperação.
- **Pesquisa:** referências oficiais, decisões propostas e limites das integrações.
- Ícones no topo: reduzir movimento, tema noturno e ampliar o celular.
- Teclado: `/` busca telas; setas esquerda/direita navegam pelo inventário; `Esc` fecha menus.
- O histórico do navegador permite voltar. Links como `index.html#finish` abrem uma tela diretamente.
- No mapa, **Só mapa** esconde os elementos que atrapalham a visão; **Mostrar controles** restaura tudo. **Modo rota** alterna o acompanhamento da próxima parada e a visão geral. Neste HTML, mapa e deslocamento são ilustrativos.

## Uma jornada para experimentar

1. Use **Reiniciar jornada** → Entrar → selecionar estabelecimento → Trabalhar nesta loja.
2. **Ficar online** → nova rota → aceitar → conferir ordem → conferir os três volumes → iniciar caminho.
3. **Cheguei** → Conferir e finalizar → código **4821**. Um código diferente mostra erro.
4. **Cobrar e conferir**: escolha método. Para dinheiro, R$ 100,00 cobre o pedido de R$ 86,90 e mostra R$ 13,10 de troco. Marque recebimento apenas após conferir.
5. Volte à entrega e **arraste** até o fim. O recibo e a próxima parada aparecem após concluir.
6. A segunda entrega é paga online e não exige código. A terceira exige código. Após a última, volte à loja.
7. Confira ganhos/acerto e encerre o turno.

Na divisão, escolha as formas de pagamento, distribua o total e confira cada parte. Se houver dinheiro, confira também o recebido e o troco. Abrir a cobrança ou escolher método **não marca pagamento**.

No painel à direita, experimente sem internet, GPS negado, exigência de foto/código/cobrança e políticas de transferência. A finalização sem rede fica **pendente**, e não libera automaticamente a próxima parada. O botão de enviar e conferir simula a reconexão e a resposta positiva quando os requisitos estão completos.

Nos chats, envie texto, use atalhos, simule áudio, abra anexos, busque, clique em uma mensagem para responder/reagir ou tente reenviar uma falha. A localização para o cliente respeita a preferência separada de privacidade.

## Escopo

Tudo é uma **simulação local de design**. Mapas, GPS, nomes, endereços, valores, áudios, câmera, documentos e mensagens são fictícios. Não há login real, chamadas de API, ligação, envio a outras pessoas, pagamento ou publicação. O estado dura enquanto a página está aberta; recarregar reinicia os dados.

A implementação nativa foi autorizada depois da aprovação do protótipo e já começou no app e backend. Ela está documentada em **IMPLEMENTACAO.md**; o HTML continua independente e usa apenas dados de demonstração. Abrir uma tela pelo índice serve para revisar sua composição, mesmo sem percorrer a jornada. As ações críticas da simulação continuam exigindo as conferências.

## Arquivos e continuidade

- [FLUXOS.md](FLUXOS.md): jornadas, alternativas, regras e o que existe versus proposta.
- [PESQUISA.md](PESQUISA.md): fontes oficiais e prioridades de produto.
- [CONTINUIDADE.md](CONTINUIDADE.md): contexto completo para outra IA continuar.
- [IMPLEMENTACAO.md](IMPLEMENTACAO.md): contratos reutilizados, etapas e estado real da implementação.
- [ETAPA-2.md](ETAPA-2.md): lote 2.1 de boas-vindas, login, cadastro e recuperação indisponível; estado e validações.
- [CHECKLIST-IMPLEMENTACAO.md](CHECKLIST-IMPLEMENTACAO.md): acompanhamento das 61 telas, código inicial, API e validação.
- [GUIA-MOTORES-CLAUDE.md](GUIA-MOTORES-CLAUDE.md): escolha de modelos com foco em economia.
- [assets/ORIGEM.md](assets/ORIGEM.md): prompt do elemento 3D e licença da fonte.
- `previews/`: capturas de revisão visual das telas principais.

## Validação

O protótipo foi aberto via `file://` no Chrome e revisado em desktop e largura de 390 px. Foram verificadas todas as composições, a galeria, os links entre telas, código incorreto/correto, cobrança/troco/divisão, pré-requisitos do arraste, continuidade da sequência, conclusão pendente sem internet e recursos de chat. Resultados finais e limitações ficam em CONTINUIDADE.md.

Na implementação, ainda faltam os contratos de pagamento, validação antecipada de código, chat entre colegas/mídia, comprovantes, ganhos/acerto e segurança. A proposta visual desses recursos já está desenhada; a integração completa continua pendente.
