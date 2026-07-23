"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  apiDownload,
  apiFetch,
  getAccessToken,
  STATUS_LABELS,
  TaskItem,
  TeamItem,
} from "@/lib/api";

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
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportAction, setReportAction] = useState<"pdf" | "email" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void reload();
  }, [mode, router]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [user, availableTasks, availableTeams] = await Promise.all([
        apiFetch<Profile>("/users/me"),
        apiFetch<Task[]>("/tasks"),
        mode === "team" ? apiFetch<TeamItem[]>("/teams") : Promise.resolve([]),
      ]);
      setProfile(user);
      setTasks(availableTasks);
      setTeams(availableTeams);
      setSelectedTeamId((current) => current || availableTeams[0]?.id || "");
    } catch (reason: unknown) {
      const message =
        reason instanceof Error ? reason.message : "Falha ao carregar dados";
      if (message === "UNAUTHORIZED") {
        localStorage.removeItem("tf_access");
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const visibleTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((task) => {
      if (mode === "personal") {
        // Individuais: atribuídas a mim e sem equipe vinculada
        return task.assignee.id === profile.id && !task.team;
      }
      // Equipe: somente atividades com equipe (filtradas pela equipe em foco)
      return (
        Boolean(task.team) &&
        (!selectedTeamId || task.team?.id === selectedTeamId)
      );
    });
  }, [mode, profile, selectedTeamId, tasks]);

  const todayTasks = useMemo(
    () =>
      visibleTasks
        .filter((task) => isTodayInSaoPaulo(task.startAt))
        .sort((a, b) => urgencyScore(b) - urgencyScore(a)),
    [visibleTasks],
  );
  const upcomingTasks = useMemo(
    () =>
      visibleTasks
        .filter(
          (task) =>
            !TERMINAL_STATUSES.has(task.status) &&
            !isTodayInSaoPaulo(task.startAt) &&
            task.derivedStatus !== "OVERDUE" &&
            new Date(task.startAt).getTime() > Date.now(),
        )
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
    [visibleTasks],
  );
  const completed = todayTasks.filter((task) => task.status === "COMPLETED");
  const overdue = visibleTasks
    .filter((task) => task.derivedStatus === "OVERDUE")
    .sort((a, b) => urgencyScore(b) - urgencyScore(a));
  const pending = todayTasks.filter(
    (task) => !TERMINAL_STATUSES.has(task.status),
  );
  const urgent = [
    ...overdue,
    ...pending.filter(
      (task) =>
        task.priority === "HIGH" && task.derivedStatus !== "OVERDUE",
    ),
  ].sort((a, b) => urgencyScore(b) - urgencyScore(a));
  const morning = todayTasks.filter(
    (task) => hourInSaoPaulo(task.startAt) < 12,
  );
  const afternoon = todayTasks.filter(
    (task) => hourInSaoPaulo(task.startAt) >= 12,
  );

  const completedMinutes = sumMinutes(completed);
  const pendingMinutes = sumMinutes(pending);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(new Date());

  async function downloadPdf() {
    setFeedback(null);
    setReportAction("pdf");
    const teamQuery =
      mode === "team" && selectedTeamId ? `?teamId=${selectedTeamId}` : "";
    try {
      await apiDownload(`/reports/tasks.pdf${teamQuery}`);
      setFeedback("PDF gerado e baixado com sucesso.");
    } catch (reason) {
      setFeedback(
        reason instanceof Error ? reason.message : "Falha ao gerar o PDF.",
      );
    } finally {
      setReportAction(null);
    }
  }

  async function emailTeam() {
    if (!selectedTeamId) return;
    setFeedback(null);
    setReportAction("email");
    try {
      const result = await apiFetch<{ recipients: number; team: string }>(
        "/reports/tasks/email",
        {
          method: "POST",
          body: JSON.stringify({ teamId: selectedTeamId }),
        },
      );
      setFeedback(
        `Relatório enviado para ${result.recipients} integrante(s) de ${result.team}.`,
      );
    } catch (reason) {
      setFeedback(
        reason instanceof Error ? reason.message : "Falha ao enviar o e-mail.",
      );
    } finally {
      setReportAction(null);
    }
  }

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
          ? `Olá, ${profile?.fullName}. Atividades individuais atribuídas a você.`
          : "Atividades vinculadas às suas equipes."
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={reportAction !== null}
            className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {reportAction === "pdf" ? "Gerando…" : "↓ Baixar PDF"}
          </button>
          {!isPersonal && (
            <button
              type="button"
              onClick={emailTeam}
              disabled={!selectedTeamId || reportAction !== null}
              className="rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm font-semibold text-teal-200 transition hover:bg-teal-400/20 disabled:opacity-50"
            >
              {reportAction === "email" ? "Enviando…" : "✉ Enviar à equipe"}
            </button>
          )}
          <Link
            href="/tasks/new"
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            + Nova atividade
          </Link>
        </div>
      }
    >
      {!isPersonal && (
        <section className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">
              Equipe em foco
            </p>
            <p className="text-xs text-slate-400">
              Filtre a visão antes de gerar ou enviar o relatório.
            </p>
          </div>
          <select
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            className="min-w-56 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-teal-400 focus:ring-2"
          >
            {teams.length === 0 && <option value="">Nenhuma equipe</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {feedback && (
        <div className="mb-5 rounded-lg border border-teal-400/25 bg-teal-400/10 px-4 py-3 text-sm text-teal-100">
          {feedback}
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi value={String(todayTasks.length)} label={todayLabel} tone="info" />
        <Kpi value={String(completed.length)} label="Concluídas" tone="success" />
        <Kpi value={String(pending.length)} label="Pendentes" tone="warning" />
        <Kpi
          value={String(overdue.length)}
          label="Atrasadas acumuladas"
          tone="danger"
        />
        <Kpi value={formatMinutes(completedMinutes)} label="Tempo concluído" />
        <Kpi value={formatMinutes(pendingMinutes)} label="Tempo pendente" />
      </section>

      {visibleTasks.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {isPersonal
            ? "Nenhuma atividade individual encontrada. Itens com equipe aparecem em Equipe; use Checklist ou Nova atividade para criar."
            : teams.length === 0
              ? "Você ainda não participa de nenhuma equipe."
              : "Nenhuma atividade de equipe neste filtro. Ao agendar, escolha “Atividade da equipe” no Checklist ou vincule a equipe na criação."}
        </div>
      )}

      <UrgentQueue
        tasks={urgent}
        mode={mode}
        onChanged={async () => {
          const availableTasks = await apiFetch<Task[]>("/tasks");
          setTasks(availableTasks);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AgendaColumn title="Manhã" tasks={morning} mode={mode} />
        <AgendaColumn title="Tarde" tasks={afternoon} mode={mode} />
      </div>

      {upcomingTasks.length > 0 && (
        <section className="mt-6">
          <AgendaColumn
            title="Próximos dias"
            tasks={upcomingTasks}
            mode={mode}
          />
        </section>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <TaskList title="Pendentes" tasks={pending} mode={mode} />
        <TaskList title="Concluídas" tasks={completed} mode={mode} />
        <TaskList title="Atrasadas" tasks={overdue} mode={mode} danger />
      </section>
    </AppShell>
  );
}

function Kpi({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-slate-700 text-slate-100",
    info: "border-cyan-400/30 text-cyan-300",
    success: "border-teal-400/30 text-teal-300",
    warning: "border-amber-400/30 text-amber-300",
    danger: "border-rose-400/40 text-rose-300",
  };
  return (
    <div
      className={`rounded-xl border bg-slate-900/80 px-3 py-3 shadow-lg shadow-black/10 ${tones[tone]}`}
    >
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs capitalize text-slate-400">{label}</p>
    </div>
  );
}

function UrgentQueue({
  tasks,
  mode,
  onChanged,
}: {
  tasks: Task[];
  mode: ViewMode;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const hasRunning = tasks.some((task) => task.status === "IN_PROGRESS");
    if (!hasRunning) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  async function setTimer(task: Task, status: "IN_PROGRESS" | "PAUSED") {
    setBusyId(task.id);
    setActionError(null);
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await onChanged();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Falha ao atualizar o timer",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-rose-400/25 bg-gradient-to-br from-rose-500/10 via-slate-900/90 to-slate-950">
      <div className="flex items-center justify-between border-b border-rose-400/15 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
            Foco imediato
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-slate-50">
            Demandas que exigem atenção
          </h2>
        </div>
        <span className="rounded-full bg-rose-400/15 px-3 py-1 text-sm font-bold tabular-nums text-rose-200">
          {tasks.length}
        </span>
      </div>
      {actionError && (
        <p className="border-b border-rose-400/15 px-5 py-3 text-sm text-rose-200">
          {actionError}
        </p>
      )}
      {tasks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          Tudo sob controle: nenhuma demanda urgente para hoje.
        </p>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const running = task.status === "IN_PROGRESS";
            const terminal = TERMINAL_STATUSES.has(task.status);
            return (
              <div
                key={task.id}
                className="rounded-xl border border-slate-700 bg-slate-950/75 p-4 transition hover:border-rose-400/50 hover:shadow-xl hover:shadow-rose-950/20"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <StatusBadge task={task} />
                  <span className="text-xs tabular-nums text-slate-400">
                    {formatTime(task.startAt)}–{formatTime(task.endAt)}
                  </span>
                </div>
                <Link
                  href={`/tasks/${task.id}`}
                  className="line-clamp-2 font-semibold text-slate-100 hover:text-white"
                >
                  {task.title}
                </Link>
                <p className="mt-2 truncate text-xs text-slate-400">
                  {mode === "team"
                    ? `${task.assignee.fullName} · ${task.team?.name ?? "Equipe"}`
                    : task.team?.name ?? "Atividade pessoal"}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <p className="text-xs tabular-nums text-slate-300">
                    Tempo:{" "}
                    <span className="font-semibold text-teal-300">
                      {formatElapsed(workedMs(task))}
                    </span>
                    {running ? " · em andamento" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null || terminal || running}
                      onClick={() => void setTimer(task, "IN_PROGRESS")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-40"
                      aria-label="Iniciar demanda"
                      title="Play"
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null || terminal || !running}
                      onClick={() => void setTimer(task, "PAUSED")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-400/40 bg-rose-400/15 text-sm font-bold text-rose-200 hover:bg-rose-400/25 disabled:opacity-40"
                      aria-label="Parar demanda"
                      title="Stop"
                    >
                      ■
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function workedMs(task: Task) {
  const closedMs = (task.actualDurationMinutes ?? 0) * 60_000;
  if (task.status === "IN_PROGRESS" && task.timerStartedAt) {
    return closedMs + Math.max(0, Date.now() - new Date(task.timerStartedAt).getTime());
  }
  return closedMs;
}

function formatElapsed(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 shadow-xl shadow-black/10">
      <h2 className="mb-3 font-display text-lg font-semibold text-slate-100">
        {title}
      </h2>
      {tasks.length === 0 ? (
        <p className="py-5 text-center text-sm text-slate-500">
          Nenhuma atividade neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className={`flex items-start gap-3 rounded-xl border bg-slate-950/70 px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-lg ${
                  task.derivedStatus === "OVERDUE"
                    ? "border-rose-400/40 hover:border-rose-300/70"
                    : task.priority === "HIGH"
                      ? "border-amber-400/35 hover:border-amber-300/60"
                      : "border-slate-700 hover:border-teal-400/40"
                }`}
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${priorityDot[task.priority]}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {formatTime(task.startAt)}–{formatTime(task.endAt)}
                    </p>
                    <StatusBadge task={task} />
                  </div>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {task.title}
                  </p>
                  <p className="truncate text-xs text-slate-400">
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
      className={`rounded-2xl border bg-slate-900/75 p-4 ${
        danger ? "border-rose-400/40" : "border-slate-700/80"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="text-xs tabular-nums text-slate-400">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma atividade.</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-300">
          {tasks.map((task) => (
            <li key={task.id} className="border-t border-slate-700 pt-2">
              <Link href={`/tasks/${task.id}`} className="block hover:underline">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-100">{task.title}</p>
                  <StatusBadge task={task} />
                </div>
                <p className="text-xs text-slate-400">
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

function StatusBadge({ task }: { task: Task }) {
  const overdue = task.derivedStatus === "OVERDUE";
  const label = overdue
    ? STATUS_LABELS.OVERDUE
    : task.priority === "HIGH"
      ? "Alta prioridade"
      : STATUS_LABELS[task.derivedStatus] ?? task.derivedStatus;
  const color = overdue
    ? "border-rose-400/30 bg-rose-400/15 text-rose-200"
    : task.priority === "HIGH"
      ? "border-amber-400/30 bg-amber-400/15 text-amber-200"
      : task.status === "COMPLETED"
        ? "border-teal-400/25 bg-teal-400/10 text-teal-200"
        : "border-slate-600 bg-slate-800 text-slate-300";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {label}
    </span>
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

function dateKeyInSaoPaulo(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isTodayInSaoPaulo(value: string) {
  return dateKeyInSaoPaulo(value) === dateKeyInSaoPaulo(new Date());
}

function hourInSaoPaulo(value: string) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return Number(hour);
}

function urgencyScore(task: Task) {
  if (task.derivedStatus === "OVERDUE") return 100;
  if (TERMINAL_STATUSES.has(task.status)) return 0;
  if (task.priority === "HIGH") return 75;
  if (task.priority === "MEDIUM") return 45;
  return 20;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
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
