"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { API_BASE, apiFetch, TeamItem } from "@/lib/api";

function buildSlots() {
  const slots: string[] = [];
  let h = 8;
  let m = 45;
  while (h < 16 || (h === 16 && m <= 45)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 15;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }
  return slots;
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toSaoPauloIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

export function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slots = useMemo(() => buildSlots(), []);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => searchParams.get("date") ?? todayLocal());
  const [start, setStart] = useState("08:45");
  const [end, setEnd] = useState("09:15");
  const [priority, setPriority] = useState("MEDIUM");
  const [scope, setScope] = useState<"personal" | "team">(
    searchParams.get("teamId") ? "team" : "personal",
  );
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void apiFetch<TeamItem[]>("/teams")
      .then((data) => {
        setTeams(data);
        const preselected = searchParams.get("teamId");
        if (preselected && data.some((team) => team.id === preselected)) {
          setScope("team");
          setTeamId(preselected);
        } else if (data.length === 1) {
          setTeamId((current) => current || data[0].id);
        } else if (data[0]) {
          setTeamId((current) => current || data[0].id);
        }
      })
      .catch(() => setTeams([]));
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = localStorage.getItem("tf_access");
      if (!accessToken) {
        router.push("/login");
        return;
      }

      if (end <= start) {
        throw new Error("O horário final deve ser depois do início");
      }

      if (scope === "team") {
        if (teams.length === 0) {
          throw new Error(
            "Você ainda não participa de nenhuma equipe. Entre em uma equipe ou escolha Individual.",
          );
        }
        if (!teamId) {
          throw new Error("Selecione a equipe da atividade");
        }
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        date,
        startAt: toSaoPauloIso(date, start),
        endAt: toSaoPauloIso(date, end),
        priority,
      };
      if (scope === "team" && teamId) {
        payload.teamId = teamId;
        payload.visibility = "TEAM";
      }

      let response = await createTask(accessToken, payload);

      if (response.status === 409) {
        const confirmed = window.confirm(
          "Já existe uma atividade nesse horário. Deseja salvar mesmo assim?",
        );
        if (!confirmed) {
          setError("Salvamento cancelado por conflito de horário.");
          return;
        }
        const overlapReason = window.prompt(
          "Informe o motivo para manter o conflito:",
        );
        if (!overlapReason?.trim()) {
          throw new Error("O motivo do conflito é obrigatório");
        }
        response = await createTask(accessToken, {
          ...payload,
          force: true,
          overlapReason,
        });
      }

      if (response.status === 401) {
        localStorage.removeItem("tf_access");
        localStorage.removeItem("tf_refresh");
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message;
        throw new Error(message ?? "Não foi possível salvar a atividade");
      }
      router.push(scope === "team" ? "/team" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="Nova atividade"
      subtitle="Escolha se a demanda é individual ou em equipe"
    >
      <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
        <fieldset className="rounded-xl border border-[var(--line)] bg-white/80 p-4">
          <legend className="px-1 text-sm font-semibold text-brand-900">
            Tipo de atividade
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScope("personal")}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                scope === "personal"
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                  : "border-[var(--line)] bg-white text-brand-900 hover:border-brand-500/50"
              }`}
            >
              <span className="block text-sm font-semibold">Individual</span>
              <span
                className={`mt-1 block text-xs ${
                  scope === "personal" ? "text-white/80" : "text-brand-700/70"
                }`}
              >
                Só aparece nas suas atividades pessoais
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                scope === "team"
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                  : "border-[var(--line)] bg-white text-brand-900 hover:border-brand-500/50"
              }`}
            >
              <span className="block text-sm font-semibold">Em equipe</span>
              <span
                className={`mt-1 block text-xs ${
                  scope === "team" ? "text-white/80" : "text-brand-700/70"
                }`}
              >
                Compartilhada com os membros da equipe
              </span>
            </button>
          </div>

          {scope === "team" && (
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Equipe</span>
              {teams.length === 0 ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Você ainda não está em nenhuma equipe. Aceite um convite ou
                  peça ao administrador para convidar seu e-mail.
                </p>
              ) : (
                <>
                  <select
                    required
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
                  >
                    <option value="" disabled>
                      Selecione a equipe
                    </option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-brand-700/70">
                    Todos os membros verão esta demanda na aba Equipe.
                  </span>
                </>
              )}
            </label>
          )}
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Data</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block">Início previsto</span>
            <select
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Fim previsto</span>
            <select
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block">Prioridade</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
          </select>
        </label>
        {error && <p className="text-sm text-priority-high">{error}</p>}
        <button
          type="submit"
          disabled={loading || (scope === "team" && teams.length === 0)}
          className="rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {loading ? "Salvando…" : "Salvar atividade"}
        </button>
      </form>
    </AppShell>
  );
}

function createTask(accessToken: string, payload: Record<string, unknown>) {
  return fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
