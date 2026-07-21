import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-medium tracking-wide text-brand-500">
        Gestão de atividades
      </p>
      <BrandLogo className="-my-8 h-72 w-96 max-w-full" priority />
      <p className="mt-2 max-w-xl text-lg text-brand-700/80">
        Planeje o dia em blocos de 15 minutos, compartilhe com a equipe e
        acompanhe atrasos em tempo real.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-md bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-brand-500/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-white"
        >
          Criar conta
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md px-5 py-2.5 text-sm font-medium text-brand-500 underline-offset-4 hover:underline"
        >
          Ver dashboard (protótipo)
        </Link>
      </div>
    </main>
  );
}
