"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { AppShell } from "@/components/app-shell";
import {
  apiFetch,
  getAccessToken,
  PRIORITY_COLORS,
  TaskItem,
} from "@/lib/api";

export default function CalendarPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      const data = await apiFetch<TaskItem[]>("/tasks");
      setTasks(data);
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
    void loadTasks();
  }, [loadTasks]);

  const events = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    start: task.startAt,
    end: task.endAt,
    backgroundColor: PRIORITY_COLORS[task.priority],
    borderColor: PRIORITY_COLORS[task.priority],
  }));

  return (
    <AppShell
      title="Calendário"
      subtitle="Visão diária, semanal e mensal"
      actions={
        <Link
          href="/tasks/new"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
        >
          Nova atividade
        </Link>
      }
    >
      {loading ? (
        <p className="text-sm text-brand-700/70">Carregando calendário…</p>
      ) : error ? (
        <p className="text-sm text-priority-high">{error}</p>
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-white/90 p-3 md:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            locale={ptBrLocale}
            height="auto"
            slotMinTime="08:00:00"
            slotMaxTime="17:00:00"
            slotDuration="00:15:00"
            allDaySlot={false}
            nowIndicator
            editable={false}
            events={events}
            eventClick={(info) => {
              router.push(`/tasks/${info.event.id}`);
            }}
            dateClick={(info) => {
              const date = info.dateStr.slice(0, 10);
              router.push(`/tasks/new?date=${date}`);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
