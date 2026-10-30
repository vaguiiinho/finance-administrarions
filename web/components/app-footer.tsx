import Link from "next/link";

/**
 * Rodape global (design 17.8): texto simples sobre o gradiente, sem dados pessoais. `<footer>` fora de `main`/`nav`/
 * `section` = landmark contentinfo. `showDemoLink` so nas telas protegidas normais (PL3). O link usa `--text`
 * sublinhado (o fallback do design quando `--accent` nao garante 4,5:1 sobre o gradiente).
 */
export function AppFooter({ year, version, showDemoLink = false }: { year: number; version?: string; showDemoLink?: boolean }) {
  return (
    <footer className="mt-8 border-t border-border pb-[max(24px,env(safe-area-inset-bottom))] pt-6 md:mt-12">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-muted">
        <p className="flex flex-col sm:flex-row sm:gap-1.5">
          <span>
            <span className="font-semibold text-text">Finanças</span>
            <span aria-hidden="true"> · </span>
            <span>© {year}</span>
          </span>
          {version ? (
            <>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span>Versão {version}</span>
            </>
          ) : null}
        </p>
        {showDemoLink ? (
          <Link href="/demo/entries" className="inline-flex min-h-11 items-center font-medium text-text underline">
            Ver demonstração
          </Link>
        ) : null}
      </div>
    </footer>
  );
}
