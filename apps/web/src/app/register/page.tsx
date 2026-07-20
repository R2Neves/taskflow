"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message;
        throw new Error(msg ?? "Falha no cadastro");
      }
      const data = await res.json();
      localStorage.setItem("tf_access", data.accessToken);
      localStorage.setItem("tf_refresh", data.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="font-display text-2xl font-bold text-brand-900">
        TaskFlow
      </Link>
      <h1 className="mt-8 text-xl font-semibold">Criar conta</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-brand-700">Nome completo</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-brand-700">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-brand-700">Senha</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-brand-700">Confirmar senha</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          />
        </label>
        {error && <p className="text-sm text-priority-high">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {loading ? "Criando…" : "Cadastrar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-brand-700/80">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand-700 underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
