import type { ReactNode } from "react";

/**
 * Card de vidro do login (design 3.2, DA6): titulo e subtitulo sobre o vidro; formulario em contexto OPACO
 * (`data-surface="opaque"`, sem vidro dentro de vidro); rodape com divisoria.
 */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="card mx-auto flex w-full max-w-[420px] flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
        {subtitle ? <p className="text-muted">{subtitle}</p> : null}
      </header>
      <div data-surface="opaque" className="flex flex-col gap-4">
        {children}
      </div>
      {footer ? <footer className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted">{footer}</footer> : null}
    </section>
  );
}
