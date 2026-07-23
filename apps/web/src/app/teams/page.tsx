"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  apiFetch,
  getAccessClaims,
  getAccessToken,
  TeamItem,
} from "@/lib/api";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const claims = useMemo(() => getAccessClaims(), []);

  const loadTeams = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      const data = await apiFetch<TeamItem[]>("/teams");
      setTeams(data);
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
    void loadTeams();
  }, [loadTeams]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch("/teams", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
        }),
      });
      setName("");
      setDescription("");
      setFeedback("Equipe criada.");
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao criar equipe");
    } finally {
      setSaving(false);
    }
  }

  async function onInvite(teamId: string) {
    const email = memberEmail[teamId]?.trim();
    if (!email) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await apiFetch<{ message: string }>(
        `/teams/${teamId}/invites`,
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMemberEmail((prev) => ({ ...prev, [teamId]: "" }));
      setFeedback(result.message);
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao convidar");
    } finally {
      setSaving(false);
    }
  }

  async function onCancelInvite(teamId: string, inviteId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/teams/${teamId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      setFeedback("Convite cancelado.");
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao cancelar");
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveMember(teamId: string, memberUserId: string) {
    if (!window.confirm("Remover este integrante da equipe?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/teams/${teamId}/members/${memberUserId}`, {
        method: "DELETE",
      });
      setFeedback("Integrante removido.");
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao remover");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Gerenciar equipes"
      subtitle="Convide por e-mail; a pessoa precisa aceitar o convite no TaskFlow"
    >
      <section className="mb-8 rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
        <h2 className="font-display text-lg font-semibold text-slate-100">
          Nova equipe
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            required
            placeholder="Nome da equipe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-60"
          >
            Criar equipe
          </button>
        </form>
      </section>

      {feedback && (
        <p className="mb-4 rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-200">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-400">Carregando equipes…</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma equipe ainda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const isOwner =
              team.members.some(
                (member) =>
                  member.role === "OWNER" &&
                  (member.user.id === claims?.sub ||
                    member.user.email.toLowerCase() ===
                      claims?.email?.toLowerCase()),
              ) || team.createdById === claims?.sub;

            return (
              <article
                key={team.id}
                className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-100">{team.name}</h3>
                    {team.description && (
                      <p className="text-sm text-slate-400">{team.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {team._count?.tasks ?? 0} tarefas
                  </span>
                </div>
                <ul className="mb-3 space-y-1 text-sm">
                  {team.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-2 text-slate-300"
                    >
                      <span>
                        {member.user.fullName} · {member.user.email}
                        <span className="ml-2 text-xs uppercase text-teal-300/80">
                          {member.role}
                        </span>
                      </span>
                      {isOwner && member.role !== "OWNER" && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void onRemoveMember(team.id, member.user.id)
                          }
                          className="text-xs text-rose-300 hover:underline disabled:opacity-50"
                        >
                          Remover
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {(team.invites?.length ?? 0) > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                      Convites pendentes
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {team.invites?.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>{invite.email}</span>
                          {isOwner && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void onCancelInvite(team.id, invite.id)
                              }
                              className="text-xs text-slate-400 hover:text-rose-300 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isOwner ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="e-mail do integrante"
                      value={memberEmail[team.id] ?? ""}
                      onChange={(e) =>
                        setMemberEmail((prev) => ({
                          ...prev,
                          [team.id]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void onInvite(team.id)}
                      className="rounded-md border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-400/20 disabled:opacity-60"
                    >
                      Convidar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Somente o proprietário pode enviar convites.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
