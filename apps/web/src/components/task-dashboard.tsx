"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { apiFetch, getAccessToken, TaskItem } from "@/lib/api";

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

type ViewMode = "personal" | "team";

type Profile = {
  id: string;
  fullName: string;
};

type Task = TaskItem;

const priorityDot: Record<Task["priority"], string> = {
  LOW: "bg-priority-low",
  MEDIUM: "bg-priority-medium",
  HIGH: "bg-priority-high",
};

export function TaskDashboard({ mode }: { mode: ViewMode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    Promise.all([
      apiFetch<Profile>("/users/me"),
      apiFetch<Task[]>("/tasks"),
    ])
      .then(([user, availableTasks]) => {
        setProfile(user);
        setTasks(availableTasks);
      })
      .catch((reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : "Falha ao carregar dados";
        if (message === "UNAUTHORIZED") {
          localStorage.removeItem("tf_access");
          router.replace("/login");
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const visibleTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((task) =>
      mode === "personal" ? task.assignee.id === profile.id : Boolean(task.team),
    );
  }, [mode, profile, tasks]);

  const todayTasks = useMemo(
    () => visibleTasks.filter((task) => isToday(task.startAt)),
    [visibleTasks],
  );
  const completed = todayTasks.filter((task) => task.status === "COMPLETED");
  const overdue = todayTasks.filter((task) => task.derivedStatus === "OVERDUE");
  const pending = todayTasks.filter(
    (task) => !TERMINAL_STATUSES.has(task.status),
  );
  const morning = todayTasks.filter(
    (task) => new Date(task.startAt).getHours() < 12,
  );
  const afternoon = todayTasks.filter(
    (task) => new Date(task.startAt).getHours() >= 12,
  );

  const completedMinutes = sumMinutes(completed);
  const pendingMinutes = sumMinutes(pending);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(new Date());

  if (loading) {
    return <PageMessage>Carregando atividades…</PageMessage>;
  }

  if (error) {
    return <PageMessage danger>{error}</PageMessage>;
  }

  const isPersonal = mode === "personal";

  return (
    <AppShell
      title={isPersonal ? "Minhas atividades" : "Atividades da equipe"}
      subtitle={
        isPersonal
          ? `Olá, ${profile?.fullName}. Estas são as suas atividades.`
          : "Visão geral das atividades das suas equipes."
      }
      actions={
        <Link
          href="/tasks/new"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
        >
          Nova atividade
        </Link>
      }
    >
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi value={String(todayTasks.length)} label={todayLabel} />
        <Kpi value={String(completed.length)} label="Concluídas" />
        <Kpi value={String(pending.length)} label="Pendentes" />
        <Kpi value={String(overdue.length)} label="Atrasadas" />
        <Kpi value={formatMinutes(completedMinutes)} label="Tempo concluído" />
        <Kpi value={formatMinutes(pendingMinutes)} label="Tempo pendente" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AgendaColumn title="Manhã" tasks={morning} mode={mode} />
        <AgendaColumn title="Tarde" tasks={afternoon} mode={mode} />
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <TaskList title="Pendentes" tasks={pending} mode={mode} />
        <TaskList title="Concluídas" tasks={completed} mode={mode} />
        <TaskList title="Atrasadas" tasks={overdue} mode={mode} danger />
      </section>
    </AppShell>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white/80 px-3 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs capitalize text-brand-700/70">{label}</p>
    </div>
  );
}

function AgendaColumn({
  title,
  tasks,
  mode,
}: {
  title: string;
  tasks: Task[];
  mode: ViewMode;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white/80 p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {tasks.length === 0 ? (
        <p className="py-5 text-center text-sm text-brand-700/60">
          Nenhuma atividade neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-start gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 transition hover:border-brand-500/40"
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot[task.priority]}`}
                />
                <div className="min-w-0">
                  <p className="text-xs text-brand-700/60">
                    {formatTime(task.startAt)}–{formatTime(task.endAt)}
                  </p>
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="truncate text-xs text-brand-700/60">
                    {mode === "team"
                      ? `${task.team?.name ?? "Equipe"} · ${task.assignee.fullName}`
                      : task.team?.name ?? "Atividade pessoal"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskList({
  title,
  tasks,
  mode,
  danger,
}: {
  title: string;
  tasks: Task[];
  mode: ViewMode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white/80 p-4 ${
        danger ? "border-priority-high/40" : "border-[var(--line)]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs tabular-nums text-brand-700/60">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-brand-700/60">Nenhuma atividade.</p>
      ) : (
        <ul className="space-y-2 text-sm text-brand-700/80">
          {tasks.map((task) => (
            <li key={task.id} className="border-t border-[var(--line)] pt-2">
              <Link href={`/tasks/${task.id}`} className="block hover:underline">
                <p className="font-medium text-brand-900">{task.title}</p>
                <p className="text-xs text-brand-700/60">
                  {mode === "team"
                    ? `${task.team?.name ?? "Equipe"} · ${task.assignee.fullName}`
                    : `${formatTime(task.startAt)}–${formatTime(task.endAt)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageMessage({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className={danger ? "text-priority-high" : "text-brand-700"}>
        {children}
      </p>
    </main>
  );
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sumMinutes(tasks: Task[]) {
  return tasks.reduce((total, task) => {
    const duration =
      new Date(task.endAt).getTime() - new Date(task.startAt).getTime();
    return total + Math.max(0, duration / 60_000);
  }, 0);
}

function formatMinutes(total: number) {
  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}min`;
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
}
