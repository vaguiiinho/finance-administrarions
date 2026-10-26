import { NavLink } from "../navigation";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  /** "despesas" | "receitas" */
  noun: string;
  hrefFor: (page: number) => string;
  focusId: string;
}

function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = new Set<number>([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const linkClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-transparent px-3 font-medium text-text no-underline hover:bg-surface-2 active:bg-surface-active";

/** "Mostrando 21-40 de 135 despesas" + links reais; pagina atual = --primary-strong + --primary-border. Oculta com 1 pagina. */
export function Pagination({ page, totalPages, pageSize, totalItems, noun, hrefFor, focusId }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <nav aria-label={`Paginação de ${noun}`} className="flex flex-col items-center justify-between gap-3 py-2 sm:flex-row">
      <p className="text-sm text-muted">
        Mostrando {from}-{to} de {totalItems} {noun}
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <NavLink href={hrefFor(page - 1)} focusId={focusId} className={linkClass} aria-label="Página anterior">
              ‹ <span className="ml-1 hidden sm:inline">Anterior</span>
            </NavLink>
          ) : null}
        </li>
        <li className="text-sm text-muted md:hidden">
          Pág. {page} de {totalPages}
        </li>
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="hidden px-1 text-muted md:block">
              …
            </li>
          ) : (
            <li key={p} className="hidden md:block">
              <NavLink
                href={hrefFor(p)}
                focusId={focusId}
                aria-label={`Página ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={p === page ? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-primary-border bg-primary-strong px-3 font-semibold text-on-primary no-underline" : linkClass}
              >
                {p}
              </NavLink>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <NavLink href={hrefFor(page + 1)} focusId={focusId} className={linkClass} aria-label="Próxima página">
              <span className="mr-1 hidden sm:inline">Próxima</span> ›
            </NavLink>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
