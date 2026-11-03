import type { ReactNode } from "react";

/** Pilha unica do dashboard (ADR 0012): aviso, cabecalho, resumo, evolucao mensal e despesas por categoria, em largura total. */
export function DashboardLayout({ notice, header, summary, monthly, categories }: { notice?: ReactNode; header: ReactNode; summary: ReactNode; monthly: ReactNode; categories: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {notice}
      {header}
      {summary}
      <div className="min-w-0">{monthly}</div>
      <div className="min-w-0">{categories}</div>
    </div>
  );
}
