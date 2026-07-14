# Luckers Bot 3.0 — Bot Discord + Dashboard Web

Bot completo em JavaScript/Node.js com tickets, moderação, proteção, comunidade, economia, logs e um dashboard administrativo no estilo SaaS escuro da referência enviada.

## O que foi adicionado nesta versão

### Dashboard profissional integrado

O site roda no mesmo processo e na mesma porta do bot. Não é necessário hospedar frontend e backend separadamente.

- Login seguro com Discord OAuth2
- Acesso limitado a donos, administradores e membros com **Gerenciar Servidor**
- Seleção entre os servidores administráveis onde o bot está instalado
- Visão geral com:
  - tickets abertos
  - tempo médio de primeira resposta
  - satisfação dos usuários
  - quantidade de membros
  - comparação com períodos anteriores
- Gráfico dos tickets abertos nos últimos sete dias
- Tabela de tickets recentes
- Página completa de tickets com busca e filtros
- Assumir e liberar tickets pelo dashboard
- Alterar prioridade pelo dashboard
- Link direto para abrir o canal no Discord
- Editor visual do painel de tickets com pré-visualização
- Alteração das cores do painel e do próprio dashboard
- Configuração do anti-link, anti-spam e limite de spam
- Filtro configurável de palavras e frases com detecção de desvios (`porr4`, `p0r64`, símbolos e repetições)
- Teste do filtro antes de salvar, ação editável, mensagem automática e exceções por canal/cargo
- Domínios permitidos, janela do anti-spam e duração do timeout editáveis
- Seleção de canais, categorias e cargos
- Cargo de suporte padrão, cargo específico por setor e troca do cargo responsável por ticket
- Avaliações com 1 a 5 estrelas, comentário opcional e publicação em canal escolhido
- Publicação do painel de tickets pelo site
- Histórico local de auditoria
- Layout responsivo para computador, tablet e celular
- Estados de carregamento, mensagens de erro e notificações visuais
- Suporte a `prefers-reduced-motion`
- Cabeçalhos de segurança e cookies `HttpOnly`

### Melhorias no bot

- Novo comando `/dashboard`
- Auditoria local de ações do bot e do painel
- Banco atualizado para a versão 6
- Cor personalizada do dashboard salva por servidor
- O painel web utiliza os mesmos dados reais do sistema de tickets
- Endpoint `/health` informa também que o dashboard está ativo

## Sistemas já incluídos

### Tickets

- Painel personalizável
- Setores de suporte, denúncia, parceria, compras e outros
- Formulários diferentes por setor
- Limite por membro
- Ticket privado
- Prioridades
- Assumir e liberar atendimento
- Adicionar e remover participantes
- Notas internas
- Transcrição TXT e HTML
- Encerramento com motivo e solução
- Avaliação de 1 a 5 estrelas
- Métricas de atendimento

### Administração e proteção

- `/central` para configuração dentro do Discord
- `/falar` com caixa de texto
- Limpeza, kick, ban, timeout e avisos
- Anti-link
- Anti-spam
- Filtro de comentários/palavras com anti-bypass e moderação de mensagens editadas
- Logs de mensagens e membros
- Validação de hierarquia de cargos

### Comunidade

- Boas-vindas
- Mensagem de saída
- Cargo automático
- Sugestões com votação

### Economia e diversão

- Saldo
- Daily
- Trabalho
- Transferências
- Ranking
- Loja
- Inventário
- XP e níveis
- Moeda, dado e avatar

## Requisitos

- Node.js 20 ou superior
- Uma aplicação no Discord Developer Portal
- O bot adicionado ao servidor
- Uma URL pública HTTPS para usar o dashboard em produção

## Instalação local

Dentro da pasta do projeto:

```bash
npm install
```

Copie `.env.example` para `.env`.

### Configuração mínima do bot

```env
DISCORD_TOKEN=TOKEN_DO_BOT
PORT=8000
TEST_GUILD_ID=ID_DO_SERVIDOR_DE_TESTE
```

### Configuração do dashboard

```env
DASHBOARD_URL=http://localhost:8000
DISCORD_CLIENT_ID=APPLICATION_ID
DISCORD_CLIENT_SECRET=CLIENT_SECRET
DISCORD_REDIRECT_URI=http://localhost:8000/auth/discord/callback
SESSION_SECRET=UMA_CHAVE_ALEATORIA_GRANDE
DASHBOARD_DEMO_MODE=false
```

Gere uma chave de sessão:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Configurar o OAuth2 no Discord

1. Abra sua aplicação no Discord Developer Portal.
2. Entre em **OAuth2**.
3. Em **Redirects**, adicione exatamente:

```text
http://localhost:8000/auth/discord/callback
```

4. Quando hospedar, substitua pelo domínio público. Exemplo:

```text
https://seu-dominio.com/auth/discord/callback
```

5. Use exatamente a mesma URL no campo `DISCORD_REDIRECT_URI`.
6. Copie o **Application ID** para `DISCORD_CLIENT_ID`.
7. Gere/copiei o **Client Secret** para `DISCORD_CLIENT_SECRET`.
8. Nunca publique o Client Secret, o token ou o arquivo `.env`.

O dashboard solicita os escopos `identify` e `guilds`. Ele só lista servidores nos quais o usuário possui permissão administrativa e o bot está presente.

## Registrar comandos e iniciar

```bash
npm run deploy
npm start
```

Acesse:

```text
http://localhost:8000/dashboard
```

Dentro do Discord, administradores também podem usar:

```text
/dashboard
```

## Modo de demonstração local

Para abrir o site localmente antes de configurar OAuth2:

```env
DASHBOARD_DEMO_MODE=true
```

Esse modo usa o primeiro servidor conectado ao bot. Desative em produção.

## Hospedagem

O bot e o site precisam permanecer ligados ao mesmo tempo. A hospedagem deve:

- executar Node.js
- permitir uma porta HTTP
- fornecer uma URL pública HTTPS
- preservar o arquivo `data/database.json` ou usar armazenamento persistente

O projeto inclui:

- `Dockerfile`
- `discloud.config`
- endpoint `/health`

### Discloud

1. Preencha o `.env` com o domínio fornecido pela hospedagem.
2. Adicione a URL de callback correspondente no Discord Developer Portal.
3. Compacte o conteúdo da pasta `bot-discord`.
4. Envie o ZIP para a Discloud.
5. Rode o registro de comandos quando necessário.
6. Abra `https://DOMINIO-DA-HOSPEDAGEM/dashboard`.

## Estrutura principal

```text
bot-discord/
├── public/
│   └── dashboard/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── src/
│   ├── commands.js
│   ├── dashboard.js
│   ├── database.js
│   ├── deploy-commands.js
│   ├── index.js
│   └── validate.js
├── test/
│   ├── commands.test.js
│   └── dashboard.test.js
├── .env.example
├── Dockerfile
├── discloud.config
└── package.json
```

## Endpoints

| Rota | Função |
| --- | --- |
| `/dashboard` | Interface administrativa |
| `/auth/discord` | Inicia o login OAuth2 |
| `/auth/discord/callback` | Callback do Discord |
| `/api/me` | Usuário conectado |
| `/api/guilds` | Servidores administráveis |
| `/api/dashboard/:guildId` | Métricas e dados do painel |
| `/api/config/:guildId` | Atualiza configurações |
| `/api/panel/:guildId/publish` | Publica o painel de tickets |
| `/api/tickets/:guildId/:ticketId/claim` | Assume um ticket |
| `/api/tickets/:guildId/:ticketId/release` | Libera um ticket |
| `/health` | Estado do bot e do site |

## Verificação

```bash
npm run check
npm test
npm audit
```

## Segurança

- O token do bot e o Client Secret ficam somente no servidor.
- O navegador recebe apenas um identificador de sessão assinado.
- O token OAuth do usuário fica na memória do processo, não no navegador.
- O parâmetro OAuth `state` é validado.
- Cookies usam `HttpOnly` e `SameSite=Lax`.
- Em produção, cookies também usam `Secure`.
- O dashboard verifica permissões antes de cada leitura ou alteração.
- Menções administrativas continuam bloqueadas para evitar abuso.

## Persistência

O banco continua em:

```text
data/database.json
```

Há backup automático em:

```text
data/database.backup.json
```

Para uso grande ou múltiplas instâncias, migre posteriormente para PostgreSQL.
