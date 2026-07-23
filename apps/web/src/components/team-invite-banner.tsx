"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getAccessToken, TeamInviteItem } from "@/lib/api";

export function TeamInviteBanner() {
  const [invites, setInvites] = useState<TeamInviteItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const data = await apiFetch<TeamInviteItem[]>("/teams/invites/pending");
      setInvites(data);
      setError(null);
    } catch {
      // Silent: banner is optional UX.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function respond(inviteId: string, action: "accept" | "decline") {
    setBusyId(inviteId);
    setError(null);
    try {
      await apiFetch(`/teams/invites/${inviteId}/${action}`, {
        method: "POST",
      });
      setInvites((current) => current.filter((item) => item.id !== inviteId));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível responder",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (invites.length === 0) return null;

  return (
    <div className="border-b border-teal-400/25 bg-teal-500/10 px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-teal-100">
            Você tem {invites.length} convite
            {invites.length > 1 ? "s" : ""} de equipe pendente
            {invites.length > 1 ? "s" : ""}
          </p>
          <Link
            href="/teams"
            className="text-xs text-teal-200/80 hover:text-teal-100 hover:underline"
          >
            Ver equipes
          </Link>
        </div>
        {error && <p className="text-sm text-rose-200">{error}</p>}
        <ul className="space-y-2">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-col gap-2 rounded-xl border border-teal-400/20 bg-slate-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-100">
                  {invite.team.name}
                </p>
                <p className="text-xs text-slate-400">
                  Convite de {invite.invitedBy.fullName} ({invite.invitedBy.email})
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void respond(invite.id, "accept")}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void respond(invite.id, "decline")}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
                >
                  Recusar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
