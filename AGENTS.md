# AGENTS.md — Projeto ZippyGo

> **Projeto-alvo (deste repositório):** **ZippyGo — App do Motoboy (React Native/Expo)**  
> **Caminho local (Farley):** `D:\TI\Aplicativos\front end\MotoboyApp\zippygo-motoboy`  
> **Módulos correlatos (fora deste repo):** Painel da Pizzaria (Next.js), Backend (.NET Core + SQL Server), Futuro front/app do Cliente.  
> **Regra-mestra para o agente:** **Responda e documente sempre em português do Brasil.** Antes de editar/rodar: **mostre o plano, liste arquivos, exiba o diff e peça aprovação** para comandos de shell.

---

## 1) Visão de Negócio (contexto que o agente deve respeitar)
1. **Propósito:** digitalizar e organizar o fluxo de entregas de pizzarias (substitui comandas em papel).
2. **Atores:**
   - **Pizzaria (gestor):** gerencia motoboys, distribui pedidos/rotas, acompanha localização, histórico e valores a pagar.
   - **Motoboy (app deste repo):** recebe pedidos, organiza rota no mapa, navega (Google Maps), valida código do cliente/iFood, confirma pagamento quando necessário.
   - **Cliente (futuro front/app):** faz pedido, acompanha status/localização, recebe notificações.
3. **Metas de negócio:** diminuir erros e fricção, dar visibilidade em tempo real, aumentar eficiência e confiabilidade do processo.

---

## 2) Módulos do Ecossistema
1. **Este repositório — App do Motoboy (React Native/Expo)**
   - **Uso:** aceitar rotas, visualizar pedidos no mapa, abrir Google Maps, **confirmar entrega** (código iFood + pagamento quando aplicável).
   - **Armazenamento local:** `SecureStore` (ex.: online/offline; rota em andamento; pedidos aceitos).
   - **Imagens/ícones:** `../assets/images/`.
   - **Telas críticas:**
     - `TelaInicialMap.tsx` (mapa, pedidos, “Iniciar rota”, estados de rota).
     - `ConfirmacaoEntrega.tsx` (código, cobrança, confirmação por **arrastar**).

2. **Painel da Pizzaria (Web – Next.js) [REPO SEPARADO]**
   - Gestão de motoboys/pedidos, mapa (Mapbox), histórico/performance, integração com iFood, envio de link/WhatsApp.
   - Páginas típicas: Dashboard, Motoboys (lista/detalhe), Pedidos (lista/mapa), Integrações (iFood), Chat interno.

3. **Backend (API – .NET Core + SQL Server) [REPO SEPARADO]**
   - Controllers → Services → Repositories → DB.
   - Domínios: Pizzarias, Motoboys, Pedidos, Rotas, Pagamentos, Histórico.
   - Endpoints (exemplos):
     - `POST /deliveries/confirm` (confirma entrega; valida código iFood; atualiza status; registra pagamento quando devido).
     - `GET /drivers/{id}/locations` (telemetria em tempo real).
     - `GET /orders?status=...` (consulta pedidos).
     - `POST /payments/confirm` e `POST /payments/split`.

4. **Futuro Front/App do Cliente [REPO SEPARADO]**
   - Pedido direto, tracking e notificações (não prioritário no MVP).

---

## 3) Fluxos Funcionais (o que não pode quebrar)
1. **Organização de Rota (motoboy)**
   - Seleciona pedidos, define ordem, vê pins no mapa (Mapbox).
   - Ao **iniciar rota**: salvar destinos/pedidos no `SecureStore`; monitorar localização para detectar chegada.

2. **Chegada ao Destino → Confirmação de Entrega**
   - **Código iFood**: campo visível; após validado, **permanece visível e desabilitado** (mostra verde).
   - **Cobrança** (se requer pagamento):
     - Mostrar **botão vermelho “Cobrar”** (se **não pago**).
     - Ao tocar, exibir **valor + método de pagamento** e botões **“Confirmar pagamento”** e **“Dividir”**.
   - **Slide-to-confirm**: **só após arrastar**:
     - Confirmar a entrega.
     - Se “Confirmar pagamento” foi selecionado e **ainda não estava pago**, **marcar como pago agora**.
   - **“Próxima entrega”** só habilita quando **código validado** **e** **pagamento confirmado** (quando aplicável).

3. **Localização em Tempo Real**
   - Não deve travar o fluxo; notificar chegada com uma única notificação por destino.

---

## 4) Padrões Técnicos

### 4.1 Frontend (este repo — React Native/Expo)
- **Hooks funcionais**, evitar classes e `any`.
- Estilos: `StyleSheet`.
- **Imagens:** manter `../assets/images/`.
- Evitar recriar o mapa ao clicar em marcador (manter estado; mostrar detalhes na lateral).
- **Mapbox — pins:**
  - Próximo destino: pin padrão.
  - Demais: pins menores/cinza com **número** da ordem.
- **UI/Estados críticos**:
  - `online/offline` (persistido em `SecureStore`).
  - Rota: `organizandoRota` → `emEntrega` → `finalizada`.
  - Em seleção: ao aceitar pedidos, **re-exibir** no mapa e **ajustar bounds** para enquadrar todos.
  - **Botão “Iniciar Rota”**: sempre visível; não cobrir conteúdo (usar espaço reservado; último card translúcido quando atrás do botão).

### 4.2 Backend (.NET Core) [referência para integração]
- **async/await** em services e controllers.
- **Logs** com `ILogger<>`.
- Regras de negócio em **Services**, não nos Controllers.
- **Testes** unitários (services) e de integração (endpoints de confirmação/ pagamento).

---

## 5) Estados e Convenções (preservar)
- **Chaves `SecureStore`:** status online/offline; rota/destinos; pedidos aceitos; `indiceAtual`; objeto `pedido` vivo.
- **Arquivos relevantes neste repo** (o agente deve **localizar** por busca):
  - `TelaInicialMap.tsx`
  - `ConfirmacaoEntrega.tsx`
  - `MapComponent.tsx` / `Mapa.tsx`
  - `SelectOrdersMode.tsx`
  - `useFetchPedidos.ts`
- **Diretivas fixas:**
  - **Não** confirmar pagamento **automaticamente** ao abrir `ConfirmacaoEntrega`.
  - Input de código: **visível** → **validado** → **desabilitado** (verde).
  - “Próxima entrega” somente com **código + pagamento** (quando houver).

---

## 6) Como Rodar (scripts esperados)
### App Motoboy (este repo)
```bash
npm install
npm start
# (opcional) npm run lint
# (se houver) npm test
