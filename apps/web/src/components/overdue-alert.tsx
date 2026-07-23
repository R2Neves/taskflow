"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, getAccessToken, TaskItem } from "@/lib/api";

const DISMISS_KEY = "tf_overdue_alert_dismissed_until";
const POLL_MS = 60_000;

export function OverdueAlert() {
  const pathname = usePathname();
  const [overdue, setOverdue] = useState<TaskItem[]>([]);
  const [open, setOpen] = useState(false);

  const publicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";

  useEffect(() => {
    if (publicRoute || !getAccessToken()) {
      setOpen(false);
      setOverdue([]);
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const tasks = await apiFetch<TaskItem[]>("/tasks");
        if (cancelled) return;
        const next = tasks.filter(
          (task) => task.derivedStatus === "OVERDUE",
        );
        setOverdue(next);

        const dismissedUntil = Number(
          sessionStorage.getItem(DISMISS_KEY) ?? "0",
        );
        const stillDismissed = Date.now() < dismissedUntil;
        setOpen(next.length > 0 && !stillDismissed);
      } catch {
        if (!cancelled) {
          setOverdue([]);
          setOpen(false);
        }
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname, publicRoute]);

  const titles = useMemo(
    () => overdue.slice(0, 5).map((task) => task.title),
    [overdue],
  );

  if (!open || overdue.length === 0) return null;

  function dismiss() {
    sessionStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + 5 * 60_000),
    );
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="overdue-alert-title"
    >
      <div className="w-full max-w-2xl rounded-3xl border-2 border-rose-400/60 bg-gradient-to-b from-rose-950 via-slate-950 to-slate-950 p-8 text-center shadow-2xl shadow-rose-950/50 sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-300">
          Alerta de atraso
        </p>
        <h2
          id="overdue-alert-title"
          className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-5xl"
        >
          Urgente você tem atividade em atraso
        </h2>
        <p className="mt-4 text-base text-rose-100/80 sm:text-lg">
          {overdue.length === 1
            ? "Existe 1 atividade atrasada que precisa da sua atenção."
            : `Existem ${overdue.length} atividades atrasadas que precisam da sua atenção.`}
        </p>

        <ul className="mx-auto mt-6 max-w-lg space-y-2 text-left">
          {titles.map((title) => (
            <li
              key={title}
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-50"
            >
              {title}
            </li>
          ))}
          {overdue.length > titles.length && (
            <li className="px-1 text-sm text-rose-200/70">
              +{overdue.length - titles.length} outras atividades
            </li>
          )}
        </ul>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            onClick={dismiss}
            className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white hover:bg-rose-400"
          >
            Ver atividades atrasadas
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-slate-600 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 hover:border-slate-400"
          >
            Entendi, avisar de novo em 5 min
          </button>
        </div>
      </div>
    </div>
  );
}
