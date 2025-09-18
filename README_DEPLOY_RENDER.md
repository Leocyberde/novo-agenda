# Deploy no Render - Guia Completo

Este guia explica como fazer o deploy da aplicação Agenda no Render com migração automática das tabelas para PostgreSQL.

## Alterações Realizadas

### 1. Schema do Banco de Dados
- **Arquivo alterado**: `shared/schema.ts`
- **Mudança**: Convertido de SQLite (`sqliteTable`) para PostgreSQL (`pgTable`)
- **Backup**: O schema original foi salvo como `shared/schema-sqlite-backup.ts`

### 2. Migrações
- **Novas migrações**: Geradas automaticamente para PostgreSQL no diretório `drizzle/`
- **Arquivo principal**: `drizzle/0000_slow_wendell_vaughn.sql`

### 3. Scripts de Deploy
- **build.sh**: Script de build que executa migrações automaticamente
- **migrate.js**: Script específico para executar migrações
- **package.json**: Adicionados scripts `migrate` e `postinstall`

## Como Fazer o Deploy

### Passo 1: Preparar o Repositório
1. Faça commit de todas as alterações:
   ```bash
   git add .
   git commit -m "Migração para PostgreSQL e configuração do Render"
   git push
   ```

### Passo 2: Configurar o Render
1. Acesse [render.com](https://render.com) e faça login
2. Clique em "New +" e selecione "Web Service"
3. Conecte seu repositório GitHub

### Passo 3: Configurar o Banco de Dados
1. No dashboard do Render, clique em "New +" e selecione "PostgreSQL"
2. Configure o banco:
   - **Name**: `agenda-pag-db`
   - **Database**: `agenda_pag`
   - **User**: `agenda_user`
3. Anote a **Database URL** que será gerada

### Passo 4: Configurar o Web Service
1. Configure o serviço:
   - **Name**: `agenda-pag`
   - **Environment**: `Node`
   - **Build Command**: `./build.sh`
   - **Start Command**: `npm start`

2. Adicione as variáveis de ambiente:
   - **NODE_ENV**: `production`
   - **DATABASE_URL**: Cole a URL do banco PostgreSQL criado no passo 3

### Passo 5: Deploy Automático
1. Clique em "Create Web Service"
2. O Render executará automaticamente:
   - Instalação das dependências (`npm install`)
   - Execução das migrações (`npx drizzle-kit migrate`)
   - Build do projeto (`npm run build`)
   - Inicialização do servidor

## Verificação do Deploy

### 1. Logs do Build
Verifique os logs para confirmar que:
- As dependências foram instaladas
- As migrações foram executadas com sucesso
- O build foi concluído
- O servidor iniciou corretamente

### 2. Banco de Dados
As seguintes tabelas devem ser criadas automaticamente:
- `users`
- `merchants`
- `services`
- `employees`
- `clients`
- `appointments`
- `penalties`
- `promotions`
- `employee_days_off`

### 3. Funcionalidades
Teste as principais funcionalidades:
- Login de usuário
- Cadastro de estabelecimentos
- Criação de serviços
- Agendamentos

## Troubleshooting

### Erro de Migração
Se as migrações falharem:
1. Verifique se a `DATABASE_URL` está correta
2. Confirme se o banco PostgreSQL está ativo
3. Verifique os logs para erros específicos

### Erro de Conexão
Se houver problemas de conexão:
1. Verifique se o servidor está escutando em `0.0.0.0`
2. Confirme se a porta está configurada corretamente (`process.env.PORT`)

### Dados de Teste
O sistema criará automaticamente um usuário admin:
- **Email**: `leolulu842@gmail.com` (ou valor da variável `EMAIL_USER`)
- **Senha**: `123456` (ou valor da variável `EMAIL_PASSWORD`)

## Scripts Disponíveis

- `npm run dev`: Executa em modo desenvolvimento
- `npm run build`: Faz build do projeto
- `npm start`: Inicia o servidor em produção
- `npm run migrate`: Executa apenas as migrações
- `npm run db:push`: Push do schema para o banco

## Estrutura de Arquivos Importantes

```
├── shared/
│   ├── schema.ts                 # Schema PostgreSQL (novo)
│   └── schema-sqlite-backup.ts   # Backup do schema SQLite
├── drizzle/
│   ├── 0000_slow_wendell_vaughn.sql  # Migração PostgreSQL
│   └── meta/
│       └── _journal.json
├── server/
│   └── db.ts                     # Configuração do banco
├── build.sh                      # Script de build
├── migrate.js                    # Script de migração
├── render.yaml                   # Configuração do Render (opcional)
└── README_DEPLOY_RENDER.md       # Este arquivo
```

## Suporte

Se encontrar problemas durante o deploy:
1. Verifique os logs do Render
2. Confirme se todas as variáveis de ambiente estão configuradas
3. Teste localmente com PostgreSQL antes do deploy
4. Verifique se o repositório está atualizado com todas as alterações

