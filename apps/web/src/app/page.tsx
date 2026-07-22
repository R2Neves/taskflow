import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-teal-400/10 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            Gestão inteligente de atividades
          </p>
          <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
            Produtividade com clareza, foco e colaboração.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            Planeje o dia em blocos de 15 minutos, compartilhe atividades com
            sua equipe e acompanhe prazos em tempo real.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:-translate-y-0.5 hover:bg-teal-400"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-teal-400/40 hover:bg-slate-800"
            >
              Criar conta
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-3 text-sm font-medium text-teal-300 transition hover:text-teal-200"
            >
              Ver dashboard →
            </Link>
          </div>
        </div>

        <div className="order-first lg:order-last">
          <div className="relative rounded-3xl border border-slate-700/70 bg-slate-900/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/70 to-transparent" />
            <BrandLogo className="h-auto w-full" priority />
          </div>
        </div>
      </section>
    </main>
  );
}
