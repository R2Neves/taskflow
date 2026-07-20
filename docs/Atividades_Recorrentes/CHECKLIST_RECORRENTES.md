# Checklist — Atividades Recorrentes

## Visão geral

A feature **Atividades Recorrentes** gerencia processos que se repetem todo mês (fechamentos, conferências, apurações, envio de relatórios e demais periódicos).

O usuário cadastra um **modelo** (dia do mês + horário + categoria) e depois **gera as ocorrências** do mês de referência, materializando `Task`s normais no dashboard/calendário.

**Banco:** PostgreSQL (`RecurringActivity` + `Task.recurringActivityId`)  
**API:** NestJS `/api/v1/recurring`  
**UI:** `/recurring` (sidebar → Atividades → Atividades recorrentes)

---

## Arquitetura

### 1. Backend

| Arquivo | Descrição |
|---------|-----------|
| `apps/api/prisma/schema.prisma` | Modelos `RecurringActivity` e FK em `Task` |
| `apps/api/src/recurring/recurring.module.ts` | Módulo Nest |
| `apps/api/src/recurring/recurring.controller.ts` | Rotas HTTP |
| `apps/api/src/recurring/recurring.service.ts` | CRUD + `generateMonth` |
| `apps/api/src/recurring/dto/recurring.dto.ts` | DTOs + categorias |

### 2. Frontend

| Arquivo | Descrição |
|---------|-----------|
| `apps/web/src/app/recurring/page.tsx` | CRUD visual + gerar mês |
| `apps/web/src/components/app-shell.tsx` | Item de menu na sidebar |
| `apps/web/src/lib/api.ts` | Tipos `RecurringItem` e labels de categoria |

### 3. Shared

| Arquivo | Descrição |
|---------|-----------|
| `packages/shared/src/enums.ts` | `RECURRING_CATEGORIES` + labels |

### 4. Documentação

| Arquivo | Descrição |
|---------|-----------|
| `docs/Atividades_Recorrentes/CHECKLIST_RECORRENTES.md` | Este documento |

---

## Categorias

| Código | Label na UI |
|--------|-------------|
| `FECHAMENTO` | Fechamento mensal |
| `CONFERENCIA` | Conferência |
| `APURACAO` | Apuração |
| `RELATORIO` | Envio de relatório |
| `OUTROS` | Outros processos |

---

## Campos do modelo

| Campo | Tipo | Regra |
|-------|------|-------|
| `title` | string | Obrigatório |
| `description` | string? | Opcional |
| `category` | enum string | Default `OUTROS` |
| `dayOfMonth` | 1–31 | Em fevereiro, dia 31 → 28/29 |
| `startTime` / `endTime` | `HH:mm` | Blocos de 15 min; fim > início |
| `priority` | LOW/MEDIUM/HIGH | Default MEDIUM |
| `active` | boolean | Só ativos entram no gerar mês |
| `notes` | string? | Opcional |
| `teamId` | UUID? | Opcional; usuário deve ser membro |

---

## APIs

### `POST /api/v1/recurring`

Cria modelo. Body exemplo:

```json
{
  "title": "Fechamento contábil do mês",
  "category": "FECHAMENTO",
  "dayOfMonth": 5,
  "startTime": "09:00",
  "endTime": "10:00",
  "priority": "HIGH",
  "notes": "Conferir balancete"
}
```

### `GET /api/v1/recurring`

Lista modelos do usuário (owner ou equipe).

### `PATCH /api/v1/recurring/:id` / `DELETE /api/v1/recurring/:id`

Somente o **owner** do modelo.

### `POST /api/v1/recurring/generate-month`

```json
{
  "yearMonth": "2026-07",
  "force": false,
  "overlapReason": null
}
```

**Comportamento:**

1. Busca modelos `active = true` do usuário
2. Para cada um, calcula a data no mês (`dayOfMonth` limitado ao último dia)
3. Se já existe `Task` com o mesmo `recurringActivityId` + `date` → **pula**
4. Cria `Task` ligada ao modelo
5. Conflito de horário → item vai em `skipped` (ou usa `force` + `overlapReason`)

Resposta resume `createdCount`, `skippedCount`, `created[]`, `skipped[]`.

---

## Fluxo de uso (checklist QA)

- [ ] Acessar `/recurring` autenticado
- [ ] Criar modelo categoria **Fechamento mensal**, dia 5, 09:00–10:00
- [ ] Criar modelo **Envio de relatório**, dia 10
- [ ] Pausar um modelo → não deve gerar no mês
- [ ] Reativar o modelo
- [ ] Selecionar mês atual e clicar **Gerar mês**
- [ ] Conferir tarefas no `/dashboard` e `/calendar`
- [ ] Gerar o mesmo mês de novo → deve **ignorar** duplicatas
- [ ] Editar título do modelo e salvar
- [ ] Excluir um modelo sem ocorrências

---

## Regras importantes

1. Geração só pelo **owner** do modelo (membros de equipe veem, mas não geram o alheio).
2. Horários seguem a mesma regra de 15 minutos das tasks pontuais.
3. Após mudar o Prisma, é obrigatório `npm run db:push` (humano) — senão o dashboard quebra com coluna inexistente.
4. Agente Cursor **não** aplica `db:push` nem muta dados.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Dashboard: coluna `recurringActivityId` não existe | `cd taskflow` → `npm run db:push` |
| Nada gerado | Ver se modelos estão **Ativos** e se você é o owner |
| Conflito de horário | Confirmar override com motivo, ou ajustar horário do modelo |
| Dia 31 em fevereiro | Sistema usa o último dia do mês |

---

## Documentação relacionada

- [DOCUMENTACAO_ANALISTA.md](../DOCUMENTACAO_ANALISTA.md)
- [DEPLOY.md](../DEPLOY.md)
