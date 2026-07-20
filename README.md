# TaskFlow

Sistema web de gestão de atividades individuais e em equipe.

## Stack

- **Web:** Next.js · TypeScript · Tailwind · React Query · FullCalendar
- **API:** NestJS · Prisma · PostgreSQL · JWT · Socket.IO
- **Shared:** enums, tipos e schemas Zod

## Pré-requisitos

- Node.js 20+
- Docker (PostgreSQL)

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:push
```

## Desenvolvimento

```bash
# terminal 1 — API (porta 3001)
npm run dev:api

# terminal 2 — Web (porta 3000)
npm run dev:web
```

## Roadmap MVP (6 sprints)

1. Fundação + Auth  
2. CRUD de tarefas + conflitos de horário  
3. Dashboard + Calendário  
4. Equipes + compartilhamento  
5. Comentários + histórico + notificações WS  
6. Papéis + filtros + responsivo + E2E  

## Estrutura

```
taskflow/
  apps/web          # Next.js
  apps/api          # NestJS + Prisma
  packages/shared   # Tipos compartilhados
  docker-compose.yml
  docker/postgres/init  # role somente leitura
```

## Política de acesso ao banco

| Consumidor | Credencial | Pode escrever? |
|---|---|---|
| API NestJS (produto) | `DATABASE_URL` (`taskflow`) | Sim — auth, tarefas, etc. |
| Agente Cursor / tooling | `DATABASE_URL_READONLY` (`taskflow_readonly`) | **Não** — só SELECT |
| Prisma Studio / `db push` | não usar via agente | Mutam schema/dados — bloqueados pela regra do projeto |

A regra em `.cursor/rules/database-readonly-tools.mdc` proíbe o agente de qualquer alteração no banco.
