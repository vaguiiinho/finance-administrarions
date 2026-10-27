import { Money } from "@/components/ui/money";
import { StatusDot } from "@/components/ui/status";
import { countLabel } from "@/lib/entries/feedback";
import type { ExpenseTotalsDto } from "@/lib/api/types";

/**
 * Faixa de subtotal (D21, RF11): `--surface-2`, 14px, rotulo "Subtotal"; sempre visivel (sem salto de layout).
 * Os valores vem da API (conjunto filtrado inteiro, nao a pagina) - nunca somados no cliente (CA50).
 */
export function ExpensesSubtotal({ count, totals, filtered }: { count: number; totals: ExpenseTotalsDto; filtered: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 glass rounded-lg bg-card-2 px-4 py-3 text-sm" data-testid="subtotal">
      <p className="font-medium text-muted">Subtotal · {filtered ? "com os filtros aplicados" : "todas as despesas do mês"}</p>
      <p className="text-muted">
        <span className="text-text">{countLabel(count, "despesa", "despesas")}</span>
      </p>
      <p className="text-muted">
        Total <Money value={totals.total} className="text-text" />
      </p>
      <p className="text-muted">
        <StatusDot status="PAID">Pago</StatusDot> <Money value={totals.paid} className="text-text" />
      </p>
      <p className="text-muted">
        <StatusDot status="PENDING">Pendente</StatusDot> <Money value={totals.pending} className="text-text" />
      </p>
    </div>
  );
}

export function IncomeSubtotal({ count, total, filtered }: { count: number; total: string; filtered: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 glass rounded-lg bg-card-2 px-4 py-3 text-sm" data-testid="subtotal">
      <p className="font-medium text-muted">Subtotal · {filtered ? "com o filtro aplicado" : "todas as receitas do mês"}</p>
      <p className="text-text">{countLabel(count, "receita", "receitas")}</p>
      <p className="text-muted">
        Total <Money value={total} className="text-text" />
      </p>
    </div>
  );
}
