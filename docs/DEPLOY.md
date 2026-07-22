# Deploy / Setup — TaskFlow

> Guia para operar o servidor central da rede interna e o ambiente local de desenvolvimento.  
> Última atualização: 2026-07-22

---

## Visão geral

O TaskFlow roda em **três serviços Docker** no servidor central:

| Serviço | Função | Porta no host |
|---------|--------|---------------|
| `taskflow-postgres` (Docker) | Banco PostgreSQL 16 | `127.0.0.1:5433` (tooling local) |
| API NestJS | Backend `/api/v1` | interna (rede Docker) |
| Web Next.js | Frontend + proxy `/api/v1` | `3080` |

O `docker-compose.yml` sobe a pilha completa. Apenas a Web é publicada na rede
pela porta **3080** (evita conflito com outras apps na 3000). API e PostgreSQL
ficam na rede interna do Docker.

---

## Pré-requisitos

1. **Node.js 20+**
2. **Docker** e **Docker Compose**
3. Porta **3080** livre na rede; **5433** livre em localhost
4. Cópia do projeto (pasta `taskflow`)

### Verificar

```powershell
node -v
docker version
docker compose version
```

---

## Opção A — Servidor central na rede interna (recomendado)

Use um computador Windows que permaneça ligado e conectado à rede privada da
empresa. Reserve um IP fixo para ele no roteador/DHCP.

### 1. Configurar o ambiente

```powershell
cd C:\Projetos_Em_Geral\taskflow
copy .env.example .env
```

No `.env`:

- troque os segredos JWT por valores longos e aleatórios;
- defina `PUBLIC_APP_URL=http://IP_DO_SERVIDOR:3080`;
- configure SMTP, se os relatórios por e-mail forem utilizados;
- não versione nem envie o arquivo `.env`.

### 2. Liberar o acesso na rede

Abra o PowerShell como Administrador e execute:

```powershell
.\scripts\lan\configure-firewall.ps1
```

O script libera somente TCP **3080** no perfil de rede **Privada**. Não exponha
3001 nem 5432/5433 no firewall ou no roteador.

### 3. Iniciar e verificar

```powershell
.\scripts\lan\start-taskflow.ps1
.\scripts\lan\status-taskflow.ps1
```

Todos devem acessar o endereço exibido pelo segundo script, por exemplo
`http://192.168.1.20:3080`. Não use `localhost` nos computadores dos usuários.

O Docker reinicia os serviços automaticamente. Configure o Docker Desktop para
iniciar com o Windows.

### 4. Atualizar uma instalação central

```powershell
git pull
.\scripts\lan\start-taskflow.ps1
```

O script reconstrói as imagens e preserva o volume do PostgreSQL.

### 5. Parar sem apagar dados

```powershell
.\scripts\lan\stop-taskflow.ps1
```

## Migração dos dados do computador do Felipe

1. Felipe gera um backup completo do PostgreSQL local e entrega o arquivo ao
   responsável pela infraestrutura.
2. O responsável valida e arquiva uma cópia do banco central atual.
3. Um operador humano restaura o backup no PostgreSQL central. O agente Cursor
   não executa restaurações nem outras mutações no banco.
4. Após a restauração, valide por consulta que usuários, equipes, atividades e
   seus relacionamentos foram preservados.
5. Confirme o acesso de `flima@beautyservices.com.br` e do administrador pela
   URL de rede. Se o administrador não existir no backup, cadastre-o pela
   própria aplicação.

Não combine bancos manualmente: IDs de usuários, equipes e atividades possuem
relacionamentos. O backup do Felipe deve ser tratado como a origem escolhida.
Checklist detalhado: [MIGRACAO_DADOS_FELIPE.md](MIGRACAO_DADOS_FELIPE.md).

---

## Opção B — Setup local para desenvolvimento

Execute **sempre** a partir da pasta do projeto:

```powershell
cd C:\Projetos_Em_Geral\taskflow
```

> Se aparecer `ENOENT ... package.json` em `C:\Projetos_Em_Geral`, você está um nível acima. Entre em `taskflow`.

### 1. Ambiente

```powershell
copy .env.example .env
```

Edite `.env` se necessário (segredos JWT em produção).

### 2. Banco

```powershell
docker compose up -d postgres
npm install
npm run db:generate
npm run db:push
```

| Comando | O que faz |
|---------|-----------|
| `docker compose up -d postgres` | Sobe somente Postgres para desenvolvimento |
| `npm run db:generate` | Gera Prisma Client |
| `npm run db:push` | Sincroniza schema Prisma → banco (**setup humano**) |

### 3. Aplicação

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev:web
```

### 4. Validar

| URL | Esperado |
|-----|----------|
| http://localhost:3001/api/v1/health | `{ "status": "ok", ... }` |
| http://localhost:3000 | Landing TaskFlow |
| http://localhost:3000/register | Criar conta e ir ao dashboard |

---

## Opção C — Migrar o código para outra máquina

### Na origem

1. Garantir que o código está atualizado
2. (Opcional) Exportar dados do Postgres com `pg_dump` se precisar preservar usuários/tarefas
3. Copiar pasta do projeto + arquivo `.env` (tratar como sensível)

### No destino

1. Instalar Node 20+ e Docker
2. Copiar projeto para o caminho desejado
3. Seguir a **Opção A**
4. Se trouxe dump: restaurar no container `taskflow-postgres` antes de usar a app

> Ainda não há scripts `deploy.ps1` / backup automatizados neste repositório (diferente do Protheus VBeauty). Use Docker + Prisma conforme acima.

---

## Cenários comuns

### Cenário 1 — Nova instalação

1. `copy .env.example .env`
2. `docker compose up -d postgres`
3. `npm install && npm run db:generate && npm run db:push`
4. `npm run dev:api` + `npm run dev:web`
5. Criar conta em `/register`

### Cenário 2 — Atualizar código com mudança de schema

1. `git pull` (ou receber pasta nova)
2. `npm install`
3. `npm run db:generate`
4. `npm run db:push` ← **obrigatório** se o Prisma mudou
5. Reiniciar API e Web

### Cenário 3 — Erro `column Task.recurringActivityId does not exist`

O client Prisma está à frente do banco.

```powershell
cd C:\Projetos_Em_Geral\taskflow
npm run db:push
```

Reinicie a API se necessário e recarregue o browser.

### Cenário 4 — Volume Postgres novo sem role readonly

O script `docker/postgres/init/01-readonly-role.sql` só roda na **primeira** criação do volume.  
Se o volume já existia sem o role, aplique o SQL manualmente (setup humano) ou recrie o volume com aprovação explícita da equipe.

---

## Comandos úteis

```powershell
# Status do Postgres
docker compose ps

# Logs do Postgres
docker compose logs -f postgres

# Parar Postgres (mantém dados no volume)
docker compose down

# NÃO usar sem aprovação: apaga dados
# docker compose down -v

# Verificar se readonly bloqueia escrita
npm run db:assert-readonly
```

---

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Conexão da API (escrita) |
| `DATABASE_URL_READONLY` | Tooling / agente (SELECT only) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Segredos JWT |
| `API_PORT` | Porta da API (padrão 3001) |
| `CORS_ORIGIN` | Origem permitida (padrão http://localhost:3000) |
| `PUBLIC_APP_URL` | URL compartilhada da Web na rede interna |
| `INTERNAL_API_URL` | Destino server-side do proxy Web → API |

Detalhes: [DOCUMENTACAO_ANALISTA.md](DOCUMENTACAO_ANALISTA.md#9-variáveis-de-ambiente).

---

## Política de banco (importante)

| Quem | Pode escrever? |
|------|----------------|
| API NestJS | Sim (`DATABASE_URL`) |
| Agente Cursor / scripts de consulta | Não (`DATABASE_URL_READONLY`) |
| Analista em setup | Sim — `db:push` / init SQL com ciência do impacto |

Regra do projeto: `.cursor/rules/database-readonly-tools.mdc`.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `ENOENT package.json` | `cd` para `...\taskflow` |
| Postgres não sobe | `docker compose logs postgres` — porta 5432 ocupada? |
| API sobe mas dashboard quebra | Rodar `npm run db:push` |
| CORS no browser | Usar a URL central e conferir `PUBLIC_APP_URL` |
| Outro computador abre dados diferentes | Não usar `localhost`; acessar o IP do servidor |
| Login ok, depois 401 | Access expirou (15m) — logar de novo |

---

## Documentação relacionada

- [DOCUMENTACAO_ANALISTA.md](DOCUMENTACAO_ANALISTA.md) — visão técnica completa
- [MIGRACAO_DADOS_FELIPE.md](MIGRACAO_DADOS_FELIPE.md) — transferência para o banco central
- [Atividades_Recorrentes/CHECKLIST_RECORRENTES.md](Atividades_Recorrentes/CHECKLIST_RECORRENTES.md)
- [README.md](../README.md)
