"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessClaims } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  adminOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: "Visão geral",
    items: [
      {
        href: "/dashboard",
        label: "Minhas atividades",
        description: "Agenda e indicadores do dia",
      },
      {
        href: "/team",
        label: "Equipe",
        description: "Atividades compartilhadas",
      },
      {
        href: "/calendar",
        label: "Calendário",
        description: "Visão diária, semanal e mensal",
      },
    ],
  },
  {
    title: "Atividades",
    items: [
      {
        href: "/tasks/new",
        label: "Nova atividade",
        description: "Agendar tarefa pontual",
      },
      {
        href: "/recurring",
        label: "Atividades recorrentes",
        description: "Processos mensais e periódicos",
      },
    ],
  },
  {
    title: "Organização",
    items: [
      {
        href: "/teams",
        label: "Gerenciar equipes",
        description: "Criar equipes e convidar membros",
      },
      {
        href: "/admin",
        label: "Painel administrador",
        description: "Gerenciar acessos e permissões",
        adminOnly: true,
      },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/tasks/new") {
    return pathname === "/tasks/new";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const claims = getAccessClaims();
    setIsAdmin(
      claims?.systemRole === "ADMIN" ||
        claims?.email?.toLowerCase() === "rneves@beautyservices.com.br",
    );
  }, [pathname]);

  function logout() {
    localStorage.removeItem("tf_access");
    localStorage.removeItem("tf_refresh");
    router.replace("/login");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur-xl transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-800 px-5 py-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="block"
            aria-label="TaskFlow — início"
          >
            <BrandLogo className="h-28 w-full" priority />
          </Link>
          <p className="mt-2 text-xs text-slate-500">
            Gestão de atividades e processos
          </p>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items
                  .filter((item) => !item.adminOnly || isAdmin)
                  .map((item) => {
                  const active = isActive(pathname, item.href);
                  const isRecurring = item.href === "/recurring";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`block rounded-lg px-3 py-2.5 transition ${
                          active
                            ? "bg-gradient-to-r from-teal-500/25 to-cyan-500/10 text-teal-100 ring-1 ring-teal-400/25"
                            : isRecurring
                              ? "border border-teal-400/15 bg-teal-400/5 text-slate-200 hover:bg-teal-400/10"
                              : "text-slate-300 hover:bg-slate-900 hover:text-white"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {item.label}
                        </span>
                        {item.description && (
                          <span
                            className={`mt-0.5 block text-xs ${
                              active ? "text-teal-100/65" : "text-slate-500"
                            }`}
                          >
                            {item.description}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-300"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <AppSidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/75 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 md:hidden"
              aria-label="Abrir menu"
            >
              <span className="text-lg leading-none">☰</span>
            </button>

            <div className="min-w-0 flex-1">
              {title ? (
                <>
                  <h1 className="truncate font-display text-xl font-semibold text-slate-50 md:text-2xl">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="truncate text-sm text-slate-400">
                      {subtitle}
                    </p>
                  )}
                </>
              ) : (
                <Link
                  href="/dashboard"
                  className="md:hidden"
                  aria-label="TaskFlow — início"
                >
                  <BrandLogo className="h-10 w-28" />
                </Link>
              )}
            </div>

            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
