"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  apiFetch,
  getAccessToken,
  PRIORITY_COLORS,
  STATUS_LABELS,
  TaskItem,
  TeamItem,
} from "@/lib/api";

type ViewMode = "personal" | "team";
type StatusFilter = "COMPLETED" | "CANCELLED" | "ALL";

type Profile = {
  id: string;
  fullName: string;
};

const PRIORITY_LABELS: Record<TaskItem["priority"], string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
};

export default function FinishedActivitiesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [mode, setMode] = useState<ViewMode>("personal");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("COMPLETED");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [user, availableTasks, availableTeams] = await Promise.all([
        apiFetch<Profile>("/users/me"),
        apiFetch<TaskItem[]>("/tasks"),
        apiFetch<TeamItem[]>("/teams"),
      ]);
      setProfile(user);
      setTasks(availableTasks);
      setTeams(availableTeams);
      setSelectedTeamId((current) => current || availableTeams[0]?.id || "");
    } catch (reason) {
      if (reason instanceof Error && reason.message === "UNAUTHORIZED") {
        localStorage.removeItem("tf_access");
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  const scopedFinished = useMemo(() => {
    if (!profile) return [];
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (task.status !== "COMPLETED" && task.status !== "CANCELLED") {
        return false;
      }

      if (mode === "personal") {
        if (task.assignee.id !== profile.id || task.team) return false;
      } else if (
        !task.team ||
        (selectedTeamId && task.team.id !== selectedTeamId)
      ) {
        return false;
      }

      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        task.assignee.fullName.toLowerCase().includes(query) ||
        (task.team?.name.toLowerCase().includes(query) ?? false)
      );
    });
  }, [mode, profile, search, selectedTeamId, tasks]);

  const finishedTasks = useMemo(() => {
    return scopedFinished
      .filter((task) => {
        if (statusFilter === "ALL") return true;
        return task.status === statusFilter;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [scopedFinished, statusFilter]);

  const completedCount = scopedFinished.filter(
    (task) => task.status === "COMPLETED",
  ).length;
  const cancelledCount = scopedFinished.filter(
    (task) => task.status === "CANCELLED",
  ).length;

  return (
    <AppShell
      title="Atividades finalizadas"
      subtitle={
        mode === "personal"
          ? "Histórico das suas demandas individuais"
          : "Histórico das demandas compartilhadas com a equipe"
      }
      actions={
        <Link
          href={mode === "personal" ? "/dashboard" : "/team"}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-teal-400/40 hover:text-white"
        >
          Voltar à agenda
        </Link>
      }
    >
      <div className="space-y-5 px-4 py-5 md:px-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 p-1">
              <ModeButton
                active={mode === "personal"}
                onClick={() => setMode("personal")}
                label="Individual"
              />
              <ModeButton
                active={mode === "team"}
                onClick={() => setMode("team")}
                label="Equipe"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={statusFilter === "COMPLETED"}
                onClick={() => setStatusFilter("COMPLETED")}
                label="Concluídas"
              />
              <FilterChip
                active={statusFilter === "CANCELLED"}
                onClick={() => setStatusFilter("CANCELLED")}
                label="Canceladas"
              />
              <FilterChip
                active={statusFilter === "ALL"}
                onClick={() => setStatusFilter("ALL")}
                label="Todas"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:items-center">
            {mode === "team" && (
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                {teams.length === 0 ? (
                  <option value="">Nenhuma equipe</option>
                ) : (
                  teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))
                )}
              </select>
            )}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título ou responsável"
              className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Listadas" value={finishedTasks.length} />
          <StatCard label="Concluídas" value={completedCount} tone="teal" />
          <StatCard label="Canceladas" value={cancelledCount} tone="rose" />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Carregando histórico...</p>
        ) : finishedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-10 text-center">
            <p className="font-display text-lg text-slate-200">
              Nenhuma atividade finalizada neste filtro
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Conclua ou cancele demandas na agenda para vê-las aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {finishedTasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="block rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 transition hover:border-teal-400/40 hover:bg-slate-900"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={task.status} />
                    <PriorityPill priority={task.priority} />
                    <span className="text-xs tabular-nums text-slate-400">
                      {formatDate(task.startAt)} · {formatTime(task.startAt)}–
                      {formatTime(task.endAt)}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-50">{task.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    {mode === "team" ? (
                      <>
                        <span>{task.team?.name ?? "Equipe"}</span>
                        <span>Responsável: {task.assignee.fullName}</span>
                      </>
                    ) : (
                      <span>Atividade pessoal</span>
                    )}
                    {typeof task.actualDurationMinutes === "number" &&
                      task.actualDurationMinutes > 0 && (
                        <span>
                          Tempo trabalhado:{" "}
                          {formatDuration(task.actualDurationMinutes)}
                        </span>
                      )}
                    <span>Atualizada {formatRelative(task.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-teal-500 text-slate-950"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-teal-400/50 bg-teal-400/15 text-teal-200"
          : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "teal" | "rose";
}) {
  const color =
    tone === "teal"
      ? "text-teal-300"
      : tone === "rose"
        ? "text-rose-300"
        : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/75 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const completed = status === "COMPLETED";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        completed
          ? "border-teal-400/30 bg-teal-400/15 text-teal-200"
          : "border-slate-600 bg-slate-800 text-slate-300"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TaskItem["priority"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function formatRelative(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  return formatDate(value);
}
