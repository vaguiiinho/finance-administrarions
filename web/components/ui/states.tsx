import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
    </svg>
  );
}

/** Banner de erro persistente (404/422 do lote, erro do drawer): borda `--danger`, icone e texto `--text`. */
export function InlineAlert({ children, tone = "danger", role = "alert", actions }: { children: ReactNode; tone?: "danger" | "info"; role?: "alert" | "status"; actions?: ReactNode }) {
  const border = tone === "danger" ? "border-danger border-l-danger" : "border-border-strong border-l-accent";
  const icon = tone === "danger" ? "text-danger-text" : "text-accent";
  return (
    <div role={role} className={`flex items-start gap-3 rounded-lg border border-l-[3px] bg-surface p-3 text-text ${border}`}>
      <span className={icon}>
        <AlertIcon />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">{children}</div>
      {actions}
    </div>
  );
}

/** Vazio com titulo, apoio e acoes (3.12). */
export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M4 10h16M9 15h6" strokeLinecap="round" />
      </svg>
      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}
