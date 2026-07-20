"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch, getAccessToken, TeamItem } from "@/lib/api";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao criar equipe");
    } finally {
      setSaving(false);
    }
  }

  async function onAddMember(teamId: string) {
    const email = memberEmail[teamId]?.trim();
    if (!email) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMemberEmail((prev) => ({ ...prev, [teamId]: "" }));
      await loadTeams();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Gerenciar equipes"
      subtitle="Crie equipes e convide integrantes por e-mail"
    >
      <section className="mb-8 rounded-xl border border-[var(--line)] bg-white/80 p-4">
        <h2 className="font-display text-lg font-semibold">Nova equipe</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            required
            placeholder="Nome da equipe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
          >
            Criar equipe
          </button>
        </form>
      </section>

      {error && <p className="mb-4 text-sm text-priority-high">{error}</p>}
      {loading ? (
        <p className="text-sm text-brand-700/70">Carregando equipes…</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-brand-700/70">Nenhuma equipe ainda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <article
              key={team.id}
              className="rounded-xl border border-[var(--line)] bg-white/80 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-brand-700/70">{team.description}</p>
                  )}
                </div>
                <span className="text-xs text-brand-700/60">
                  {team._count?.tasks ?? 0} tarefas
                </span>
              </div>
              <ul className="mb-3 space-y-1 text-sm">
                {team.members.map((member) => (
                  <li key={member.id} className="text-brand-700/80">
                    {member.user.fullName} · {member.user.email}
                    <span className="ml-2 text-xs uppercase text-brand-500">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
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
                  className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onAddMember(team.id)}
                  className="rounded-md border border-brand-500/30 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                >
                  Convidar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
