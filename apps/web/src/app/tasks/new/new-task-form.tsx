"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

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

export function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slots = useMemo(() => buildSlots(), []);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => searchParams.get("date") ?? todayLocal());
  const [start, setStart] = useState("08:45");
  const [end, setEnd] = useState("09:15");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      const payload = {
        title,
        date,
        startAt: new Date(`${date}T${start}:00`).toISOString(),
        endAt: new Date(`${date}T${end}:00`).toISOString(),
        priority,
      };
      let response = await createTask(accessToken, payload);

      if (response.status === 409) {
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
        response = await createTask(accessToken, {
          ...payload,
          force: true,
          overlapReason,
        });
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message;
        throw new Error(message ?? "Não foi possível salvar a atividade");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-brand-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Nova atividade</h1>
      <p className="mt-1 text-sm text-brand-700/70">
        Blocos de 15 min · jornada 08:45–16:45
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
          disabled={loading}
          className="rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {loading ? "Salvando…" : "Salvar atividade"}
        </button>
      </form>
    </main>
  );
}

function createTask(accessToken: string, payload: Record<string, unknown>) {
  return fetch(`${API}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
