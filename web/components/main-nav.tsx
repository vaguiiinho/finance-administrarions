"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/entries", label: "Lançamentos" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cards", label: "Cartões" },
] as const;

/** Itens da navegacao principal; ativo = `aria-current="page"` + sublinhado de 2px `--accent`. */
export function MainNav({ className = "", label = "Principal" }: { className?: string; label?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex items-center">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center px-3 text-base font-medium no-underline hover:text-text ${active ? "text-text after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:bg-accent" : "text-muted"}`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
