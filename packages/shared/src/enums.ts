export enum SystemRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum TeamRole {
  OWNER = "OWNER",
  MEMBER = "MEMBER",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum TaskStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  PAUSED = "PAUSED",
  WAITING_THIRD_PARTY = "WAITING_THIRD_PARTY",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Derived at read-time when endAt < now and status not terminal. */
export const DERIVED_OVERDUE = "OVERDUE" as const;

export enum Visibility {
  PRIVATE = "PRIVATE",
  SHARED = "SHARED",
  TEAM = "TEAM",
}

export enum ParticipantRole {
  ASSIGNEE = "ASSIGNEE",
  PARTICIPANT = "PARTICIPANT",
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.LOW]: "#22c55e",
  [Priority.MEDIUM]: "#eab308",
  [Priority.HIGH]: "#ef4444",
};

export const RECURRING_CATEGORIES = [
  "FECHAMENTO",
  "CONFERENCIA",
  "APURACAO",
  "RELATORIO",
  "OUTROS",
] as const;

export type RecurringCategory = (typeof RECURRING_CATEGORIES)[number];

export const RECURRING_CATEGORY_LABELS: Record<RecurringCategory, string> = {
  FECHAMENTO: "Fechamento mensal",
  CONFERENCIA: "Conferência",
  APURACAO: "Apuração",
  RELATORIO: "Envio de relatório",
  OUTROS: "Outros processos",
};

export const DEFAULT_WORK_START = "08:45";
export const DEFAULT_WORK_END = "16:45";
export const DEFAULT_SLOT_MINUTES = 15;
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_DAY_MINUTES = 480;
