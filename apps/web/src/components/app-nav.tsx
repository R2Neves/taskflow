"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Minhas atividades" },
  { href: "/team", label: "Equipe" },
  { href: "/calendar", label: "Calendário" },
  { href: "/teams", label: "Gerenciar equipes" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex w-fit flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-white/80 p-1">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-700 text-white"
                : "text-brand-700 hover:bg-brand-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
