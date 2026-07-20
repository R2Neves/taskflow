# Changelog — TaskFlow

Todas as mudanças relevantes do projeto são registradas aqui.

O formato é inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [0.1.0] — 2026-07-20

### Adicionado

- Auth JWT (register, login, refresh, logout)
- CRUD de tarefas com blocos de 15 min e tratamento de conflito de horário
- Dashboard pessoal e visão de equipe
- Calendário (FullCalendar)
- Gerenciamento de equipes e convite por e-mail
- Atividades recorrentes mensais (CRUD + gerar mês)
- Sidebar de navegação nas páginas autenticadas
- PostgreSQL via Docker + role `taskflow_readonly`
- Documentação em `docs/` (analista, deploy, checklist de recorrentes)

### Pendente (roadmap)

- Comentários, histórico e notificações WebSocket
- Filtros avançados, papéis refinados e E2E
