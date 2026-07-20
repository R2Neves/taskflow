"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  description?: string;
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

  function logout() {
    localStorage.removeItem("tf_access");
    localStorage.removeItem("tf_refresh");
    router.replace("/login");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-brand-900/30 transition md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--line)] bg-white/95 backdrop-blur transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-[var(--line)] px-5 py-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="font-display text-2xl font-bold text-brand-900"
          >
            TaskFlow
          </Link>
          <p className="mt-1 text-xs text-brand-700/65">
            Gestão de atividades e processos
          </p>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700/50">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const isRecurring = item.href === "/recurring";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`block rounded-lg px-3 py-2.5 transition ${
                          active
                            ? "bg-brand-700 text-white"
                            : isRecurring
                              ? "border border-brand-500/25 bg-brand-50 text-brand-900 hover:bg-brand-100"
                              : "text-brand-800 hover:bg-brand-50"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {item.label}
                        </span>
                        {item.description && (
                          <span
                            className={`mt-0.5 block text-xs ${
                              active ? "text-white/75" : "text-brand-700/60"
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

        <div className="border-t border-[var(--line)] p-3">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
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
    <div className="flex min-h-screen">
      <AppSidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/80 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] text-brand-700 md:hidden"
              aria-label="Abrir menu"
            >
              <span className="text-lg leading-none">☰</span>
            </button>

            <div className="min-w-0 flex-1">
              {title ? (
                <>
                  <h1 className="truncate font-display text-xl font-semibold text-brand-900 md:text-2xl">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="truncate text-sm text-brand-700/70">
                      {subtitle}
                    </p>
                  )}
                </>
              ) : (
                <Link
                  href="/dashboard"
                  className="font-display text-xl font-bold md:hidden"
                >
                  TaskFlow
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
