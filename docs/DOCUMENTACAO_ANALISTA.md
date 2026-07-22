# Documentação Técnica — TaskFlow

> Documento de repasse para o próximo analista/desenvolvedor.  
> Última atualização: 2026-07-20 | Versão do sistema: **0.1.0**

---

## 1. Visão geral

O **TaskFlow** é um sistema web de **gestão de atividades individuais e em equipe**, com agenda por blocos de 15 minutos, calendário, equipes e **atividades recorrentes mensais** (fechamentos, conferências, apurações, relatórios, etc.).

### Fluxo resumido

```
[Usuário] → Registra/Login → JWT (localStorage)
[Usuário] → Cria/edita tarefas → NestJS API → PostgreSQL
[Usuário] → Cadaststra recorrentes → Gera ocorrências do mês → Tasks no calendário
[Usuário] → Gerencia equipes → Compartilha atividades com membros
```

---

## 2. Arquitetura

| Camada | Tecnologia | Responsabilidade |
|--------|------------|------------------|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind | Telas, sidebar, calendário |
| API | NestJS 11 | Auth JWT, CRUD tarefas/equipes/recorrentes |
| Validação | Zod (`@taskflow/shared`) + class-validator (API) | Schemas compartilhados e DTOs |
| ORM | Prisma 6 | Schema e acesso ao PostgreSQL |
| Banco | PostgreSQL 16 (Docker) | Dados da aplicação |
| Calendário UI | FullCalendar | Visões dia / semana / mês |

### Serviços locais

| Serviço | Porta | Como sobe |
|---------|-------|-----------|
| `postgres` | 5432 | `docker compose up -d` |
| API NestJS | 3001 | `npm run dev:api` → prefixo `/api/v1` |
| Web Next.js | 3000 | `npm run dev:web` |

---

## 3. Estrutura de pastas

```
taskflow/
├── apps/
│   ├── web/                          # Next.js
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx          # Landing
│   │       │   ├── login/            # Login
│   │       │   ├── register/         # Cadastro
│   │       │   ├── dashboard/        # Minhas atividades
│   │       │   ├── team/             # Visão equipe
│   │       │   ├── calendar/         # Calendário
│   │       │   ├── teams/            # Gerenciar equipes
│   │       │   ├── recurring/        # Atividades recorrentes
│   │       │   └── tasks/            # Nova + detalhe
│   │       ├── components/
│   │       │   ├── app-shell.tsx     # Layout + sidebar
│   │       │   └── task-dashboard.tsx
│   │       └── lib/api.ts            # Client HTTP + tipos
│   └── api/                          # NestJS
│       ├── prisma/schema.prisma
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── tasks/
│           ├── teams/
│           ├── recurring/
│           └── prisma/
├── packages/shared/                  # Enums + schemas Zod
├── docker/postgres/init/             # Role somente leitura
├── docs/
│   ├── DOCUMENTACAO_ANALISTA.md      # Este arquivo
│   ├── DEPLOY.md                     # Setup / deploy local
│   └── Atividades_Recorrentes/       # Guia da feature
├── scripts/assert-readonly-db.js
├── docker-compose.yml
├── .env.example
├── README.md
└── CHANGELOG.md
```

---

## 4. Banco de dados

Schema: `apps/api/prisma/schema.prisma`  
Aplicar alterações (setup humano): `npm run db:push` na pasta `taskflow`.

### 4.1 Enums principais

| Enum | Valores |
|------|---------|
| `SystemRole` | `ADMIN`, `USER` |
| `TeamRole` | `OWNER`, `MEMBER` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH` |
| `TaskStatus` | `NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `WAITING_THIRD_PARTY`, `COMPLETED`, `CANCELLED` |
| `Visibility` | `PRIVATE`, `SHARED`, `TEAM` |

Status derivado (somente leitura): `OVERDUE` quando `endAt < agora` e status não é terminal.

### 4.2 Modelos

| Modelo | Função |
|--------|--------|
| `User` | Conta, perfil, timezone |
| `RefreshToken` | Refresh opaco (hash SHA-256) |
| `WorkSchedule` | Jornada padrão 08:45–16:45, slots 15 min |
| `Team` / `TeamMember` | Equipes e papéis |
| `Task` | Atividade agendada (opcional `teamId`, `recurringActivityId`) |
| `RecurringActivity` | Modelo mensal (dia do mês + horário + categoria) |
| `TaskParticipant` | Participantes da tarefa |
| `Comment` | Schema pronto — **API/UI ainda não** |
| `Notification` | Schema pronto — **API/UI ainda não** |
| `AuditLog` | Schema pronto — **API/UI ainda não** |

### 4.3 Política de acesso ao banco

| Consumidor | Credencial | Pode escrever? |
|------------|------------|----------------|
| API NestJS (produto) | `DATABASE_URL` (`taskflow`) | Sim |
| Agente Cursor / tooling | `DATABASE_URL_READONLY` (`taskflow_readonly`) | **Não** — só SELECT |
| `db push` / migrate / studio | setup humano | Mutam schema — **proibido ao agente** |

Role readonly criada em `docker/postgres/init/01-readonly-role.sql` (só em volume novo).  
Regra: `.cursor/rules/database-readonly-tools.mdc`.  
Probe: `npm run db:assert-readonly`.

---

## 5. Autenticação

1. `POST /auth/register` ou `/auth/login` → retorna `accessToken` + `refreshToken`
2. Access JWT: `JWT_ACCESS_SECRET`, payload `{ sub, email, systemRole }`, expiração padrão `15m`
3. Refresh: token opaco; hash no banco; rotação em `/auth/refresh`
4. Front grava em `localStorage`:
   - `tf_access`
   - `tf_refresh`
5. Rotas protegidas: header `Authorization: Bearer <accessToken>`
6. Sem `middleware.ts` no Next — proteção client-side (redirect para `/login`)
7. Logout na sidebar limpa os tokens

> Observação: o refresh é persistido, mas o client ainda **não renova automaticamente** o access em 401.

---

## 6. APIs REST

Base no navegador: `/api/v1` (proxy da Web para a API interna).

### Health / Auth / Users

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/health` | Não | Healthcheck |
| `POST` | `/auth/register` | Não | Cadastro + tokens |
| `POST` | `/auth/login` | Não | Login + tokens |
| `POST` | `/auth/refresh` | Não | Rotaciona refresh |
| `POST` | `/auth/logout` | Não | Revoga refresh |
| `GET` | `/users/me` | JWT | Perfil |

### Tasks

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/tasks` | JWT | Criar (conflito → 409) |
| `GET` | `/tasks` | JWT | Listar (`?from=&to=`) |
| `GET` | `/tasks/:id` | JWT | Detalhe |
| `PATCH` | `/tasks/:id` | JWT | Editar (owner) |
| `DELETE` | `/tasks/:id` | JWT | Excluir (owner) |

**Conflito de horário:** se já existir tarefa não terminal no mesmo intervalo do responsável → `409`. Para forçar: `force: true` + `overlapReason`.

### Teams

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/teams` | JWT | Criar (criador = OWNER) |
| `GET` | `/teams` | JWT | Minhas equipes |
| `GET` | `/teams/:id` | JWT | Detalhe |
| `POST` | `/teams/:id/members` | JWT | Convidar por e-mail (owner) |
| `DELETE` | `/teams/:id/members/:memberUserId` | JWT | Remover membro (owner) |

### Recurring

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/recurring` | JWT | Criar modelo mensal |
| `GET` | `/recurring` | JWT | Listar |
| `GET` | `/recurring/:id` | JWT | Detalhe |
| `PATCH` | `/recurring/:id` | JWT | Editar (owner) |
| `DELETE` | `/recurring/:id` | JWT | Excluir (owner) |
| `POST` | `/recurring/generate-month` | JWT | Materializar tasks do mês |

Detalhes: [Atividades_Recorrentes/CHECKLIST_RECORRENTES.md](Atividades_Recorrentes/CHECKLIST_RECORRENTES.md).

---

## 7. Telas da aplicação

| Rota | Função |
|------|--------|
| `/` | Landing — Entrar / Criar conta |
| `/login` | Login |
| `/register` | Cadastro |
| `/dashboard` | Minhas atividades do dia (KPIs + manhã/tarde) |
| `/team` | Atividades das equipes |
| `/calendar` | Calendário FullCalendar |
| `/tasks/new` | Nova atividade pontual |
| `/tasks/[id]` | Detalhe / editar / excluir |
| `/recurring` | Modelos mensais + gerar mês |
| `/teams` | Criar equipes e convidar membros |

Navegação autenticada: sidebar em `apps/web/src/components/app-shell.tsx`.

---

## 8. Como subir o ambiente

### Desenvolvimento local

```powershell
cd C:\Projetos_Em_Geral\taskflow
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:push
```

Dois terminais:

```powershell
npm run dev:api
npm run dev:web
```

Acessos:

| URL | Uso |
|-----|-----|
| http://localhost:3000 | Frontend |
| http://localhost:3000/api/v1/health | API via proxy |

Guia completo: [DEPLOY.md](DEPLOY.md).

---

## 9. Variáveis de ambiente

Arquivo: `.env.example` → copiar para `.env`

| Variável | Padrão / exemplo | Descrição |
|----------|------------------|-----------|
| `DATABASE_URL` | `postgresql://taskflow:taskflow@localhost:5432/taskflow` | App (escrita) |
| `DATABASE_URL_READONLY` | `postgresql://taskflow_readonly:...` | Tooling (somente leitura) |
| `JWT_ACCESS_SECRET` | string ≥ 32 chars | Assinatura access |
| `JWT_REFRESH_SECRET` | string ≥ 32 chars | (reservado / segregação) |
| `JWT_ACCESS_EXPIRES` | `15m` | TTL access |
| `JWT_REFRESH_EXPIRES` | `7d` | TTL refresh |
| `API_PORT` | `3001` | Porta Nest |
| `CORS_ORIGIN` | `http://localhost:3000` | CORS |
| `PUBLIC_APP_URL` | `http://IP_DO_SERVIDOR:3080` | URL compartilhada na LAN |
| `INTERNAL_API_URL` | `http://localhost:3001` | Destino server-side do proxy |

---

## 10. Regras de negócio importantes

1. **Blocos de 15 minutos** — início e fim devem alinhar a slots de 15 min.
2. **Jornada padrão** — UI sugere 08:45–16:45 (`WorkSchedule`).
3. **Conflito de horário** — bloqueia por padrão; override exige motivo (`overlapReason`).
4. **Owner da task** — só o proprietário edita/exclui.
5. **Equipes** — só o `OWNER` gerencia membros; não remove a si mesmo como owner.
6. **Recorrentes** — `dayOfMonth` 1–31; em meses curtos o dia é limitado ao último dia válido.
7. **Gerar mês** — não duplica se já existir task ligada ao mesmo modelo naquele mês.
8. **Agente Cursor** — nunca muta banco; usa apenas `DATABASE_URL_READONLY`.

---

## 11. Troubleshooting

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| `Internal server error` no dashboard | Schema Prisma ≠ banco (ex.: falta `recurringActivityId`) | Na pasta `taskflow`: `npm run db:push` e recarregar |
| `ENOENT package.json` | Comando rodado em `Projetos_Em_Geral` | `cd taskflow` antes do npm |
| Erro ao carregar dados | PostgreSQL parado | `docker compose up -d` |
| 401 / redirect login | Token ausente ou expirado | Login novamente |
| Porta 3000/3001 ocupada | Processo antigo ainda rodando | Encerrar Node/Next/Nest e subir de novo |
| Role readonly inexistente | Volume Postgres criado antes do init | Recriar volume **com aprovação** ou aplicar SQL de init manualmente |

---

## 12. Roadmap MVP (6 sprints)

| Sprint | Escopo | Status |
|--------|--------|--------|
| 1 | Fundação + Auth | Feito |
| 2 | CRUD tarefas + conflitos | Feito |
| 3 | Dashboard + Calendário | Feito |
| 4 | Equipes + compartilhamento | Feito |
| — | Atividades recorrentes mensais | Feito (além do roadmap original) |
| 5 | Comentários + histórico + notificações WS | Pendente (schema parcial) |
| 6 | Papéis + filtros + responsivo + E2E | Pendente |

---

## 13. Próximos passos sugeridos

- [ ] Auto-refresh do access token no client
- [ ] API/UI de comentários
- [ ] Gateway Socket.IO para notificações em tempo real
- [ ] Filtros avançados (prioridade, status, equipe, categoria)
- [ ] Testes E2E (Playwright/Cypress)
- [ ] Deploy containerizado da API + Web (hoje só Postgres no Compose)

---

## 14. Dependências principais

| Pacote | Uso |
|--------|-----|
| `next` ^15 | Frontend |
| `react` ^19 | UI |
| `@nestjs/*` ^11 | API |
| `@prisma/client` / `prisma` ^6 | ORM |
| `@fullcalendar/*` | Calendário |
| `@tanstack/react-query` | Client cache (provider pronto) |
| `passport-jwt` / `@nestjs/jwt` | Auth |
| `bcrypt` | Hash de senha |
| `zod` (`@taskflow/shared`) | Schemas compartilhados |

---

## 15. Histórico de versões

Ver [CHANGELOG.md](../CHANGELOG.md).

---

## Documentação relacionada

- [DEPLOY.md](DEPLOY.md) — setup e implantação local
- [Atividades_Recorrentes/CHECKLIST_RECORRENTES.md](Atividades_Recorrentes/CHECKLIST_RECORRENTES.md) — feature de processos mensais
- [README.md](../README.md) — visão rápida do projeto
