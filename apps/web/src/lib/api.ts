const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tf_access");
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

  const response = await fetch(`${API}${path}`, { ...options, headers });
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

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  startAt: string;
  endAt: string;
  date: string;
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
