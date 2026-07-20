"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import {
  apiFetch,
  getAccessToken,
  STATUS_LABELS,
  TaskItem,
} from "@/lib/api";

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

function toLocalDate(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toLocalTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}


export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const slots = useMemo(() => buildSlots(), []);
  const [task, setTask] = useState<TaskItem | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:45");
  const [end, setEnd] = useState("09:15");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState("NOT_STARTED");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<TaskItem>(`/tasks/${params.id}`)
      .then((data) => {
        setTask(data);
        setTitle(data.title);
        setDate(toLocalDate(data.startAt));
        setStart(toLocalTime(data.startAt));
        setEnd(toLocalTime(data.endAt));
        setPriority(data.priority);
        setStatus(data.status);
        setNotes(data.notes ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.message === "UNAUTHORIZED") {
          localStorage.removeItem("tf_access");
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "Falha ao carregar");
      })
      .finally(() => setLoading(false));
  }, [params.id, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        date,
        startAt: new Date(`${date}T${start}:00`).toISOString(),
        endAt: new Date(`${date}T${end}:00`).toISOString(),
        priority,
        status,
        notes: notes || undefined,
      };
      try {
        const updated = await apiFetch<TaskItem>(`/tasks/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setTask(updated);
        router.push("/dashboard");
      } catch (reason) {
        const statusCode =
          reason && typeof reason === "object" && "status" in reason
            ? Number((reason as { status?: number }).status)
            : 0;
        if (statusCode !== 409) throw reason;
        const confirmed = window.confirm(
          "Já existe uma atividade nesse horário. Deseja salvar mesmo assim?",
        );
        if (!confirmed) return;
        const overlapReason = window.prompt(
          "Informe o motivo para manter o conflito:",
        );
        if (!overlapReason?.trim()) {
          throw new Error("O motivo do conflito é obrigatório");
        }
        await apiFetch<TaskItem>(`/tasks/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, force: true, overlapReason }),
        });
        router.push("/dashboard");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Excluir esta atividade?")) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${params.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao excluir");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-brand-700">Carregando atividade…</p>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="text-priority-high">{error ?? "Atividade não encontrada"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand-700 underline">
          Voltar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6 md:px-6">
      <Link href="/" className="font-display text-2xl font-bold">
        TaskFlow
      </Link>
      <div className="mt-6">
        <AppNav />
      </div>
      <h1 className="font-display text-2xl font-bold">Detalhe da atividade</h1>
      <p className="mt-1 text-sm text-brand-700/70">
        Status derivado: {STATUS_LABELS[task.derivedStatus] ?? task.derivedStatus}
        {task.team ? ` · ${task.team.name}` : ""}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            <span className="mb-1 block">Início</span>
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
            <span className="mb-1 block">Fim</span>
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
        <div className="grid grid-cols-2 gap-3">
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
          <label className="block text-sm">
            <span className="mb-1 block">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            >
              <option value="NOT_STARTED">Não iniciada</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="PAUSED">Pausada</option>
              <option value="WAITING_THIRD_PARTY">Aguardando terceiro</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block">Observações</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-priority-high">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="rounded-md border border-priority-high/40 px-4 py-2.5 text-sm font-semibold text-priority-high hover:bg-red-50 disabled:opacity-60"
          >
            Excluir
          </button>
          <Link
            href="/dashboard"
            className="rounded-md px-4 py-2.5 text-sm font-medium text-brand-700 hover:underline"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
