"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch, getAccessClaims, getAccessToken } from "@/lib/api";

type Account = {
  id: string;
  fullName: string;
  email: string;
  systemRole: "ADMIN" | "USER";
  createdAt: string;
  updatedAt: string;
  _count: {
    ownedTasks: number;
    assignedTasks: number;
    memberships: number;
  };
};

const BOOTSTRAP_ADMIN = "rneves@beautyservices.com.br";

export default function AdminPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const claims = getAccessClaims();
    if (
      !getAccessToken() ||
      (claims?.systemRole !== "ADMIN" &&
        claims?.email?.toLowerCase() !== BOOTSTRAP_ADMIN)
    ) {
      router.replace("/dashboard");
      return;
    }
    loadAccounts();
  }, [router]);

  async function loadAccounts() {
    setLoading(true);
    try {
      setAccounts(await apiFetch<Account[]>("/users/admin/accounts"));
    } catch (reason) {
      setFeedback(
        reason instanceof Error ? reason.message : "Falha ao carregar acessos",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save(account: Account) {
    setSavingId(account.id);
    setFeedback(null);
    try {
      const updated = await apiFetch<Account>(
        `/users/admin/accounts/${account.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: account.fullName,
            systemRole: account.systemRole,
          }),
        },
      );
      setAccounts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setFeedback(`Acesso de ${updated.fullName} atualizado.`);
    } catch (reason) {
      setFeedback(
        reason instanceof Error ? reason.message : "Falha ao atualizar acesso",
      );
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter(
      (account) =>
        account.fullName.toLowerCase().includes(term) ||
        account.email.toLowerCase().includes(term),
    );
  }, [accounts, search]);

  const admins = accounts.filter(
    (account) => account.systemRole === "ADMIN",
  ).length;

  return (
    <AppShell
      title="Painel administrador"
      subtitle="Gerencie os acessos e as permissões da plataforma."
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Acessos cadastrados" value={accounts.length} />
        <Metric label="Administradores" value={admins} accent />
        <Metric label="Usuários padrão" value={accounts.length - admins} />
      </section>

      <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Localizar acesso
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busque por nome ou e-mail"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
          />
        </label>
      </section>

      {feedback && (
        <p className="mb-5 rounded-xl border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-100">
          {feedback}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-slate-400">
          Carregando acessos…
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((account) => {
            const protectedAdmin =
              account.email.toLowerCase() === BOOTSTRAP_ADMIN;
            return (
              <article
                key={account.id}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl shadow-black/10"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {account.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Criado em{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(account.createdAt),
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      account.systemRole === "ADMIN"
                        ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                        : "border-slate-600 bg-slate-800 text-slate-300"
                    }`}
                  >
                    {account.systemRole === "ADMIN" ? "ADMIN" : "USUÁRIO"}
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-400">Nome</span>
                    <input
                      value={account.fullName}
                      onChange={(event) =>
                        setAccounts((current) =>
                          current.map((item) =>
                            item.id === account.id
                              ? { ...item, fullName: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-400">
                      Nível de acesso
                    </span>
                    <select
                      value={account.systemRole}
                      disabled={protectedAdmin}
                      onChange={(event) =>
                        setAccounts((current) =>
                          current.map((item) =>
                            item.id === account.id
                              ? {
                                  ...item,
                                  systemRole: event.target.value as
                                    | "ADMIN"
                                    | "USER",
                                }
                              : item,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 disabled:opacity-60"
                    >
                      <option value="USER">Usuário padrão</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-700 pt-4">
                  <p className="text-xs text-slate-500">
                    {account._count.assignedTasks} demandas ·{" "}
                    {account._count.memberships} equipes
                  </p>
                  <button
                    type="button"
                    onClick={() => save(account)}
                    disabled={savingId !== null}
                    className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
                  >
                    {savingId === account.id ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-slate-900/80 p-4 ${
        accent ? "border-teal-400/30" : "border-slate-700"
      }`}
    >
      <p
        className={`text-3xl font-bold tabular-nums ${
          accent ? "text-teal-300" : "text-slate-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}
