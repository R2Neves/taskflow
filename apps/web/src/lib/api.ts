export const API_BASE = "/api/v1";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_access");
}

export function getAccessClaims() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return JSON.parse(atob(payload)) as {
      sub: string;
      email: string;
      systemRole: "ADMIN" | "USER";
    };
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    const error = new Error(message ?? "Falha na requisição") as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = response.status;
    error.body = body;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message ?? "Falha ao gerar relatório");
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "taskflow-demandas.pdf";
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  startAt: string;
  endAt: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  actualDurationMinutes?: number | null;
  timerStartedAt?: string | null;
  priority: TaskPriority;
  status: string;
  derivedStatus: string;
  visibility: string;
  assignee: { id: string; fullName: string; email: string };
  owner: { id: string; fullName: string; email: string };
  team: { id: string; name: string } | null;
};

export type TeamItem = {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  members: Array<{
    id: string;
    role: "OWNER" | "MEMBER";
    user: { id: string; fullName: string; email: string };
  }>;
  _count?: { tasks: number };
};

export type ChecklistItem = {
  id: string;
  title: string;
  notes?: string | null;
  scope: "PERSONAL" | "TEAM";
  teamId?: string | null;
  done: boolean;
  sortOrder: number;
  convertedTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
  team: { id: string; name: string } | null;
  convertedTask: {
    id: string;
    title: string;
    date: string;
    startAt: string;
    endAt: string;
  } | null;
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#ef4444",
};

export const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausada",
  WAITING_THIRD_PARTY: "Aguardando terceiro",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  OVERDUE: "Atrasada",
};

export type RecurringCategory =
  | "FECHAMENTO"
  | "CONFERENCIA"
  | "APURACAO"
  | "RELATORIO"
  | "OUTROS";

export type RecurringItem = {
  id: string;
  title: string;
  description?: string | null;
  category: RecurringCategory | string;
  dayOfMonth: number;
  startTime: string;
  endTime: string;
  priority: TaskPriority;
  active: boolean;
  notes?: string | null;
  teamId?: string | null;
  team: { id: string; name: string } | null;
  owner: { id: string; fullName: string; email: string };
  _count?: { tasks: number };
};

export const RECURRING_CATEGORY_LABELS: Record<RecurringCategory, string> = {
  FECHAMENTO: "Fechamento mensal",
  CONFERENCIA: "Conferência",
  APURACAO: "Apuração",
  RELATORIO: "Envio de relatório",
  OUTROS: "Outros processos",
};
