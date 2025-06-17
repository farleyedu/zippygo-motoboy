# ZippyGo Motoboy 📦🛵

Aplicativo mobile React Native para motoboys realizarem entregas de forma otimizada, com localização em tempo real, rotas, histórico de entregas e comunicação com a pizzaria.

---

## 📱 Visão Geral

O **ZippyGo Motoboy** é parte do ecossistema **ZippyGo**, uma plataforma completa que conecta pizzarias, motoboys e clientes. Este app é voltado exclusivamente para os entregadores, permitindo:

- Visualização de rotas e pedidos.
- Compartilhamento de localização em tempo real.
- Histórico de entregas e ganhos acumulados.
- Sistema de mensagens com a pizzaria.
- Interface leve, rápida e responsiva.

---

## 🧱 Tecnologias Utilizadas

- **React Native**
- **Expo**
- **Mapbox** (visualização de mapa e rotas)
- **TypeScript**
- **React Navigation**
- **Axios** (comunicação com API)
- **Context API** (gerenciamento de estado)

---

## 🗺️ Funcionalidades do App

- **Mapa em tempo real** com os pedidos e sua localização.
- **Painel de ganhos** atualizado automaticamente.
- **Sistema de conexão** com o estabelecimento.
- **Rotas otimizadas** para entrega.
- **Painel de pedidos** com status (retirado, concluído, pendente).
- **Chat interno** com as pizzarias.
- **Expansão de cards** com informações detalhadas ao toque ou arraste.

---

## 🧪 Instalação e Execução

```bash
# Clone o repositório
git clone https://github.com/farleyedu/zippygo-motoboy

# Acesse o diretório
cd zippygo-motoboy

# Instale as dependências
npm install

# Rode o projeto com o Expo
npx expo start
```

> **Pré-requisitos**: Node.js, npm e Expo CLI instalados.

---

## 🔗 API Backend

Este app consome dados de uma **API .NET Core** hospedada externamente, que gerencia:
- Pedidos em tempo real
- Autenticação
- Dados dos motoboys
- Status e histórico

---

## 📦 Estrutura do Projeto

```
zippygo-motoboy/
├── components/           # Componentes reutilizáveis (cards, painéis, etc)
├── screens/              # Telas principais do app
├── services/             # Requisições HTTP e integração com a API
├── style/                # CSS Modules e estilos organizados
├── context/              # Contextos globais (usuário, pedidos)
├── assets/               # Ícones, imagens e mapas
├── App.tsx               # Componente raiz
└── ...
```

---

## 🚧 Em Desenvolvimento

Funcionalidades em andamento:

- [ ] Tela de login/cadastro de motoboys
- [ ] Notificações por push
- [ ] Histórico completo de ganhos e rotas
- [ ] Modo escuro
- [ ] Otimização do uso de GPS

---

## 🙋‍♂️ Autor

Desenvolvido por **Farley Eduardo**  
[LinkedIn](https://www.linkedin.com/in/farleyeduardo) · [GitHub](https://github.com/farleyedu)

---

## 📜 Licença

Este projeto está licenciado sob a **MIT License**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🏁 Contribuições

Pull requests são bem-vindos. Para contribuir:

1. Fork este repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça seus commits: `git commit -m 'Minha nova feature'`
4. Envie um push: `git push origin minha-feature`
5. Abra um pull request!

