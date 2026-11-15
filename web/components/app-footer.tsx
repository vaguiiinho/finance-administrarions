/**
 * Rodape global (design 17.8): texto simples sobre o gradiente, sem dados pessoais. `<footer>` fora de `main`/`nav`/
 * `section` = landmark contentinfo.
 */
export function AppFooter({ year, version }: { year: number; version?: string }) {
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
      </div>
    </footer>
  );
}
