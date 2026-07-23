"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  apiFetch,
  ChecklistItem,
  getAccessToken,
  TeamItem,
} from "@/lib/api";

type ScheduleMode = "PERSONAL" | "TEAM";

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

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

export default function ChecklistPage() {
  const router = useRouter();
  const slots = useMemo(() => buildSlots(), []);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("PERSONAL");
  const [date, setDate] = useState(todayLocal);
  const [start, setStart] = useState("08:45");
  const [end, setEnd] = useState("09:15");
  const [priority, setPriority] = useState("MEDIUM");
  const [teamId, setTeamId] = useState("");

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [checklist, myTeams] = await Promise.all([
        apiFetch<ChecklistItem[]>("/checklist"),
        apiFetch<TeamItem[]>("/teams"),
      ]);
      setItems(checklist);
      setTeams(myTeams);
      setTeamId((current) => current || myTeams[0]?.id || "");
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
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch("/checklist", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          scope: "PERSONAL",
        }),
      });
      setTitle("");
      setNotes("");
      setFeedback("Item adicionado ao checklist.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(item: ChecklistItem) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/checklist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !item.done }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Remover este item do checklist?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/checklist/${id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao remover");
    } finally {
      setSaving(false);
    }
  }

  function openSchedule(item: ChecklistItem, mode: ScheduleMode) {
    setSchedulingId(item.id);
    setScheduleMode(mode);
    setDate(todayLocal());
    setStart("08:45");
    setEnd("09:15");
    setPriority("MEDIUM");
    setTeamId(item.teamId || teams[0]?.id || "");
    setFeedback(null);
    setError(null);
  }

  async function confirmSchedule(event: FormEvent) {
    event.preventDefault();
    if (!schedulingId) return;
    if (scheduleMode === "TEAM" && !teamId) {
      setError("Selecione uma equipe para agendar.");
      return;
    }
    if (end <= start) {
      setError("O horário final deve ser depois do início.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        date,
        startTime: start,
        endTime: end,
        priority,
      };
      if (scheduleMode === "TEAM") {
        payload.teamId = teamId;
      }

      let result = await apiFetch<{
        item: ChecklistItem;
        task: { id: string; title: string };
      }>(`/checklist/${schedulingId}/schedule`, {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch(async (reason: unknown) => {
        const status =
          reason && typeof reason === "object" && "status" in reason
            ? Number((reason as { status?: number }).status)
            : 0;
        if (status !== 409) throw reason;
        const confirmed = window.confirm(
          "Já existe uma atividade nesse horário. Deseja salvar mesmo assim?",
        );
        if (!confirmed) {
          throw new Error("Agendamento cancelado por conflito de horário.");
        }
        const overlapReason = window.prompt(
          "Informe o motivo para manter o conflito:",
        );
        if (!overlapReason?.trim()) {
          throw new Error("O motivo do conflito é obrigatório");
        }
        return apiFetch<{ item: ChecklistItem; task: { id: string; title: string } }>(
          `/checklist/${schedulingId}/schedule`,
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              force: true,
              overlapReason,
            }),
          },
        );
      });

      setFeedback(
        scheduleMode === "TEAM"
          ? `"${result.task.title}" agendada para a equipe.`
          : `"${result.task.title}" agendada como atividade diária.`,
      );
      setSchedulingId(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Checklist"
      subtitle="Liste tudo o que precisa fazer e transforme em atividade diária ou da equipe."
    >
      <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="font-display text-lg font-semibold text-slate-50">
          Novo item
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="O que precisa ser feito?"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observação (opcional)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>
      </section>

      {feedback && (
        <p className="mb-5 rounded-xl border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-100">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      )}

      {schedulingId && (
        <section className="mb-6 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Agendar item
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-50">
                {scheduleMode === "TEAM"
                  ? "Atividade para equipe"
                  : "Atividade diária"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSchedulingId(null)}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>
          <form
            onSubmit={confirmSchedule}
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-5"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Data</span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Início</span>
              <select
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Fim</span>
              <select
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Prioridade</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
              </select>
            </label>
            {scheduleMode === "TEAM" ? (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Equipe</span>
                <select
                  required
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                >
                  {teams.length === 0 && (
                    <option value="">Nenhuma equipe</option>
                  )}
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
                >
                  Confirmar agenda
                </button>
              </div>
            )}
            {scheduleMode === "TEAM" && (
              <div className="md:col-span-2 lg:col-span-5">
                <button
                  type="submit"
                  disabled={saving || teams.length === 0}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
                >
                  Confirmar agenda na equipe
                </button>
                {teams.length === 0 && (
                  <p className="mt-2 text-sm text-amber-200">
                    Crie uma equipe em{" "}
                    <Link href="/teams" className="underline">
                      Gerenciar equipes
                    </Link>{" "}
                    antes de agendar.
                  </p>
                )}
              </div>
            )}
          </form>
        </section>
      )}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Carregando checklist…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChecklistColumn
            title="A fazer"
            empty="Nenhum item pendente."
            items={open}
            saving={saving}
            onToggle={toggleDone}
            onRemove={removeItem}
            onSchedulePersonal={(item) => openSchedule(item, "PERSONAL")}
            onScheduleTeam={(item) => openSchedule(item, "TEAM")}
          />
          <ChecklistColumn
            title="Concluídos / agendados"
            empty="Nenhum item concluído."
            items={done}
            saving={saving}
            onToggle={toggleDone}
            onRemove={removeItem}
          />
        </div>
      )}
    </AppShell>
  );
}

function ChecklistColumn({
  title,
  empty,
  items,
  saving,
  onToggle,
  onRemove,
  onSchedulePersonal,
  onScheduleTeam,
}: {
  title: string;
  empty: string;
  items: ChecklistItem[];
  saving: boolean;
  onToggle: (item: ChecklistItem) => void;
  onRemove: (id: string) => void;
  onSchedulePersonal?: (item: ChecklistItem) => void;
  onScheduleTeam?: (item: ChecklistItem) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-50">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={saving}
                  onChange={() => onToggle(item)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      item.done
                        ? "text-slate-400 line-through"
                        : "text-slate-100"
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.notes && (
                    <p className="mt-1 text-sm text-slate-400">{item.notes}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {item.scope === "TEAM"
                      ? `Equipe · ${item.team?.name ?? "sem equipe"}`
                      : "Individual"}
                    {item.convertedTaskId
                      ? " · convertida em atividade"
                      : ""}
                  </p>
                  {!item.done && onSchedulePersonal && onScheduleTeam && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSchedulePersonal(item)}
                        className="rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-400/20 disabled:opacity-50"
                      >
                        Atividade diária
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onScheduleTeam(item)}
                        className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        Atividade da equipe
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRemove(item.id)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                  {item.convertedTaskId && (
                    <Link
                      href={`/tasks/${item.convertedTaskId}`}
                      className="mt-3 inline-block text-xs font-medium text-teal-300 hover:underline"
                    >
                      Abrir atividade gerada →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
