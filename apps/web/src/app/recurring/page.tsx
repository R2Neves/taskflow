"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  apiFetch,
  getAccessToken,
  RECURRING_CATEGORY_LABELS,
  RecurringCategory,
  RecurringItem,
  TeamItem,
} from "@/lib/api";

const CATEGORIES = Object.keys(
  RECURRING_CATEGORY_LABELS,
) as RecurringCategory[];

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

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const emptyForm = {
  title: "",
  description: "",
  category: "FECHAMENTO" as RecurringCategory,
  dayOfMonth: "5",
  startTime: "09:00",
  endTime: "10:00",
  priority: "MEDIUM",
  notes: "",
  teamId: "",
};

export default function RecurringPage() {
  const router = useRouter();
  const slots = useMemo(() => buildSlots(), []);
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      const [recurring, teamList] = await Promise.all([
        apiFetch<RecurringItem[]>("/recurring"),
        apiFetch<TeamItem[]>("/teams"),
      ]);
      setItems(recurring);
      setTeams(teamList);
      setError(null);
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

  function startEdit(item: RecurringItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? "",
      category: (item.category as RecurringCategory) || "OUTROS",
      dayOfMonth: String(item.dayOfMonth),
      startTime: item.startTime,
      endTime: item.endTime,
      priority: item.priority,
      notes: item.notes ?? "",
      teamId: item.teamId ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      dayOfMonth: Number(form.dayOfMonth),
      startTime: form.startTime,
      endTime: form.endTime,
      priority: form.priority,
      notes: form.notes.trim() || undefined,
      teamId: form.teamId || undefined,
      active: true,
    };
    try {
      if (editingId) {
        await apiFetch(`/recurring/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Atividade recorrente atualizada.");
      } else {
        await apiFetch("/recurring", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Atividade recorrente criada.");
      }
      resetForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(item: RecurringItem) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/recurring/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Excluir esta atividade recorrente?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/recurring/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await load();
      setMessage("Atividade recorrente excluída.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateMonth() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{
        createdCount: number;
        skippedCount: number;
        skipped: Array<{ title: string; reason: string }>;
      }>("/recurring/generate-month", {
        method: "POST",
        body: JSON.stringify({ yearMonth }),
      });
      setMessage(
        `Mês ${yearMonth}: ${result.createdCount} gerada(s), ${result.skippedCount} ignorada(s).`,
      );
      if (result.skipped.length > 0) {
        const details = result.skipped
          .slice(0, 3)
          .map((s) => `${s.title}: ${s.reason}`)
          .join(" · ");
        setError(details);
      }
      await load();
    } catch (reason) {
      const statusCode =
        reason && typeof reason === "object" && "status" in reason
          ? Number((reason as { status?: number }).status)
          : 0;
      if (statusCode === 409) {
        const confirmed = window.confirm(
          "Há conflitos de horário. Gerar mesmo assim?",
        );
        if (!confirmed) {
          setSaving(false);
          return;
        }
        const overlapReason = window.prompt(
          "Informe o motivo para manter o conflito:",
        );
        if (!overlapReason?.trim()) {
          setError("O motivo do conflito é obrigatório");
          setSaving(false);
          return;
        }
        try {
          const result = await apiFetch<{
            createdCount: number;
            skippedCount: number;
          }>("/recurring/generate-month", {
            method: "POST",
            body: JSON.stringify({
              yearMonth,
              force: true,
              overlapReason,
            }),
          });
          setMessage(
            `Mês ${yearMonth}: ${result.createdCount} gerada(s), ${result.skippedCount} ignorada(s).`,
          );
          await load();
        } catch (inner) {
          setError(inner instanceof Error ? inner.message : "Erro ao gerar");
        } finally {
          setSaving(false);
        }
        return;
      }
      setError(reason instanceof Error ? reason.message : "Erro ao gerar");
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RecurringItem[]>();
    for (const item of items) {
      const key = item.category || "OUTROS";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return CATEGORIES.map((cat) => ({
      category: cat,
      items: map.get(cat) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [items]);

  return (
    <AppShell
      title="Atividades recorrentes"
      subtitle="Fechamentos, conferências, apurações, relatórios e outros processos mensais"
      actions={
        <button
          type="button"
          onClick={onGenerateMonth}
          disabled={saving || items.length === 0}
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          Gerar mês
        </button>
      }
    >
      <section className="mb-6 rounded-xl border border-[var(--line)] bg-white/80 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-brand-700/70">
              Mês de referência
            </span>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <p className="max-w-xl text-sm text-brand-700/70">
            Gera automaticamente as ocorrências do mês para cada modelo ativo
            que você possui, no dia configurado.
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-[var(--line)] bg-white/80 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? "Editar modelo" : "Novo modelo mensal"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-brand-700 hover:underline"
            >
              Cancelar edição
            </button>
          )}
        </div>
        <form
          onSubmit={onSubmit}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <label className="block text-sm md:col-span-2 lg:col-span-3">
            <span className="mb-1 block">Título</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Fechamento contábil do mês"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Categoria</span>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as RecurringCategory,
                }))
              }
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {RECURRING_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Dia do mês</span>
            <input
              type="number"
              min={1}
              max={31}
              required
              value={form.dayOfMonth}
              onChange={(e) =>
                setForm((f) => ({ ...f, dayOfMonth: e.target.value }))
              }
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Prioridade</span>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value }))
              }
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">Início</span>
            <select
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
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
            <span className="mb-1 block">Fim</span>
            <select
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
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
            <span className="mb-1 block">Equipe (opcional)</span>
            <select
              value={form.teamId}
              onChange={(e) =>
                setForm((f) => ({ ...f, teamId: e.target.value }))
              }
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              <option value="">Pessoal</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2 lg:col-span-3">
            <span className="mb-1 block">Descrição</span>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Resumo do processo periódico"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2 lg:col-span-3">
            <span className="mb-1 block">Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <div className="md:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {saving
                ? "Salvando…"
                : editingId
                  ? "Salvar alterações"
                  : "Criar atividade recorrente"}
            </button>
          </div>
        </form>
      </section>

      {message && (
        <p className="mb-4 text-sm font-medium text-brand-700">{message}</p>
      )}
      {error && <p className="mb-4 text-sm text-priority-high">{error}</p>}

      {loading ? (
        <p className="text-sm text-brand-700/70">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-700/70">
          Nenhum processo periódico cadastrado. Crie o primeiro modelo acima.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.category}>
              <h3 className="mb-3 font-display text-lg font-semibold">
                {RECURRING_CATEGORY_LABELS[group.category]}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border bg-white/80 p-4 ${
                      item.active
                        ? "border-[var(--line)]"
                        : "border-dashed border-brand-500/30 opacity-70"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-brand-900">
                          {item.title}
                        </h4>
                        <p className="text-xs text-brand-700/60">
                          Dia {item.dayOfMonth} · {item.startTime}–{item.endTime}
                          {item.team ? ` · ${item.team.name}` : " · Pessoal"}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          item.active
                            ? "bg-brand-50 text-brand-700"
                            : "bg-brand-100 text-brand-700/70"
                        }`}
                      >
                        {item.active ? "Ativa" : "Pausada"}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mb-3 text-sm text-brand-700/75">
                        {item.description}
                      </p>
                    )}
                    <p className="mb-3 text-xs text-brand-700/55">
                      {item._count?.tasks ?? 0} ocorrência(s) gerada(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => startEdit(item)}
                        className="rounded-md border border-brand-500/30 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onToggleActive(item)}
                        className="rounded-md border border-brand-500/30 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                      >
                        {item.active ? "Pausar" : "Reativar"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onDelete(item.id)}
                        className="rounded-md border border-priority-high/30 px-3 py-1.5 text-xs font-medium text-priority-high hover:bg-red-50 disabled:opacity-60"
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
