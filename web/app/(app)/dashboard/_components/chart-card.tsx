"use client";

import { useId, type ReactNode } from "react";

export type ChartView = "chart" | "table";

interface ChartCardProps {
  title: string;
  subtitle: string;
  view: ChartView;
  onViewChange: (view: ChartView) => void;
  /** Esconde o alternador (ex.: sem dados) */
  hideToggle?: boolean;
  description: string;
  children: ReactNode;
}

/** Moldura de grafico: `figure` com titulo, alternador Grafico | Tabela e resumo textual em `aria-describedby` (5.7). */
export function ChartCard({ title, subtitle, view, onViewChange, hideToggle = false, description, children }: ChartCardProps) {
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} className="card m-0 flex min-w-0 flex-col gap-4 p-4 md:p-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-text">
            {title}
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {hideToggle ? null : (
          <div role="group" aria-label={`Visualização de ${title}`} className="segmented">
            {(["chart", "table"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => onViewChange(v)} className="min-h-11">
                {v === "chart" ? "Gráfico" : "Tabela"}
              </button>
            ))}
          </div>
        )}
      </figcaption>
      <p id={`${id}-desc`} className="sr-only">
        {description}
      </p>
      {children}
    </figure>
  );
}
