# Deploy / Setup — TaskFlow

> Guia passo a passo para analistas subirem o ambiente em uma workstation ou servidor de desenvolvimento.  
> Última atualização: 2026-07-20

---

## Visão geral

O TaskFlow roda em **três processos**:

| Serviço | Função | Porta |
|---------|--------|-------|
| `taskflow-postgres` (Docker) | Banco PostgreSQL 16 | 5432 |
| API NestJS | Backend `/api/v1` | 3001 |
| Web Next.js | Frontend | 3000 |

Neste momento o `docker-compose.yml` sobe **apenas o Postgres**. API e Web rodam via npm no host.

---

## Pré-requisitos

1. **Node.js 20+**
2. **Docker** e **Docker Compose**
3. Portas **3000**, **3001** e **5432** livres
4. Cópia do projeto (pasta `taskflow`)

### Verificar

```powershell
node -v
docker version
docker compose version
```

---

## Opção A — Setup local (recomendado)

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
docker compose up -d
npm install
npm run db:generate
npm run db:push
```

| Comando | O que faz |
|---------|-----------|
| `docker compose up -d` | Sobe Postgres + aplica init do role readonly (volume novo) |
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

## Opção B — Migrar para outra máquina

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
2. `docker compose up -d`
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
| `NEXT_PUBLIC_API_URL` | URL da API no browser |

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
| CORS no browser | Conferir `CORS_ORIGIN` e `NEXT_PUBLIC_API_URL` |
| Login ok, depois 401 | Access expirou (15m) — logar de novo |

---

## Documentação relacionada

- [DOCUMENTACAO_ANALISTA.md](DOCUMENTACAO_ANALISTA.md) — visão técnica completa
- [Atividades_Recorrentes/CHECKLIST_RECORRENTES.md](Atividades_Recorrentes/CHECKLIST_RECORRENTES.md)
- [README.md](../README.md)
