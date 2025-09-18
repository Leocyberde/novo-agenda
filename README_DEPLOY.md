# Deploy no Render - Projeto Agenda

Este projeto foi configurado para deploy em produção no Render. Aqui estão as instruções para fazer o deploy:

## Configurações Realizadas

1. **Migração de SQLite para PostgreSQL**: O projeto foi modificado para usar PostgreSQL em vez de SQLite
2. **Variáveis de ambiente configuradas**: Arquivo `.env` criado com as credenciais fornecidas
3. **Build de produção testado**: O comando `npm run build` foi executado com sucesso

## Instruções para Deploy no Render

### 1. Criar um novo Web Service no Render

1. Acesse [render.com](https://render.com) e faça login
2. Clique em "New +" e selecione "Web Service"
3. Conecte seu repositório Git ou faça upload do código

### 2. Configurações do Web Service

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

**Environment:**
- Node

**Node Version:**
- 18 ou superior

### 3. Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no painel do Render:

```
DATABASE_URL=postgresql://salaodb_user:NhlvMZmSK9C9WPy21gvqYwkRyiMhzbBF@dpg-d35ajbogjchc73eva860-a/salaodb
EMAIL_USER=gaelsalao12@gmail.com
EMAIL_PASSWORD=dbde barg qkyp lnvs
NODE_ENV=production
JWT_SECRET=R29vZ2xlSXNBbHdheXNTdXBwb3J0aW5nWW91ckRldmVsb3BtZW50MjAyNQ==
```

### 4. Configurações Adicionais

- **Auto-Deploy**: Ative para deploy automático quando houver mudanças no repositório
- **Health Check Path**: `/` (opcional)

## Estrutura do Projeto

- `client/`: Frontend React
- `server/`: Backend Express/Node.js
- `shared/`: Esquemas compartilhados (Drizzle ORM)
- `dist/`: Arquivos de build (gerados automaticamente)

## Scripts Disponíveis

- `npm run dev`: Desenvolvimento local
- `npm run build`: Build de produção
- `npm start`: Iniciar servidor de produção
- `npm run db:push`: Aplicar mudanças no banco de dados

## Observações Importantes

1. **Banco de Dados**: O projeto está configurado para usar o PostgreSQL fornecido
2. **Migrações**: As migrações do banco serão executadas automaticamente na inicialização
3. **Uploads**: A pasta `uploads/` contém arquivos de logo que serão mantidos
4. **CORS**: O servidor está configurado para aceitar requisições de qualquer origem

## Troubleshooting

Se houver problemas no deploy:

1. Verifique se todas as variáveis de ambiente estão configuradas corretamente
2. Confirme se o banco PostgreSQL está acessível
3. Verifique os logs do Render para identificar erros específicos
4. Certifique-se de que a versão do Node.js é compatível (18+)

## Contato

Em caso de dúvidas sobre o deploy, verifique os logs do Render ou entre em contato com o suporte técnico.

