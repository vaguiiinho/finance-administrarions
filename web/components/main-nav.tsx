"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui/status";

const LINKS = [
  { href: "/entries", label: "Lançamentos", icon: "list" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
  { href: "/cards", label: "Cartões", icon: "card" },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Algum item esta ativo em `pathname`? (o drawer decide o foco inicial: item ativo ou o primeiro). */
export const hasActiveNavItem = (pathname: string): boolean => LINKS.some((link) => isActive(pathname, link.href));

interface MainNavProps {
  className?: string;
  label?: string;
  /** Chamado ao ativar um item (o drawer de navegacao fecha). */
  onNavigate?: () => void;
}

/**
 * Navegacao principal vertical (design 17.5-17.7), usada pelo menu lateral e pelo drawer. Ativo = `pathname` igual ao
 * item ou dentro dele; barra de 3px `--accent`, peso 600 e `aria-current="page"` (tres sinais alem da cor).
 * "Usuarios" nao entra aqui: so no menu da conta (DL4).
 */
export function MainNav({ className = "", label = "Principal", onNavigate }: MainNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-col gap-1">
        {LINKS.map((link) => {
          const href = link.href;
          const active = isActive(pathname, href);
          return (
            <li key={link.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-base no-underline hover:bg-surface-2 hover:text-text active:bg-surface-active focus-visible:[outline-offset:-2px] ${
                  active ? "font-semibold text-text before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-sm before:bg-accent" : "font-medium text-muted"
                }`}
              >
                <span className={active ? "text-accent" : ""}>
                  <Icon name={link.icon} size={20} />
                </span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
