import { monthLongPtBR } from "@/lib/dates/format";
import { toCents } from "@/lib/money/decimal";
import type { TotalsDto } from "@/lib/api/types";
import { Money } from "./ui/money";
import { Icon, SignIndicator, StatusDot } from "./ui/status";
import { Skeleton } from "./ui/states";

const GROUP = "flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 md:rounded-xl md:border md:border-border md:bg-surface md:shadow-card md:p-4 md:first:pt-4 md:border-t";
const ROW = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5";
const BIG = "display-num text-base font-semibold text-text md:text-2xl lg:text-[28px]";
const MID = "display-num text-base font-semibold text-text md:text-lg";

const isEmpty = (t: TotalsDto) => [t.income, t.expenses.total, t.expenses.paid, t.expenses.pending].every((v) => toCents(v) === 0n);

/**
 * Resumo do mes inteiro (RF10, D10/D20): 3 grupos (Receitas; Despesas total/pago/pendente; Saldo realizado/previsto).
 * Um unico markup: card unico compacto no mobile, tres cards a partir de `md`. Os valores vem da API (nunca calculados aqui).
 */
export function MonthSummary({ month, totals, headingId }: { month: string; totals: TotalsDto; headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="card p-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <h2 id={headingId} className="sr-only md:not-sr-only md:mb-2 md:text-sm md:font-medium md:text-muted">
        Resumo de {monthLongPtBR(month)}
      </h2>
      <dl className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
        <div className={GROUP}>
          <div className={ROW}>
            <dt className="flex items-center gap-1.5 text-sm font-medium text-income">
              <Icon name="arrowIn" />
              Receitas
            </dt>
            <dd className={BIG}>
              <Money value={totals.income} />
            </dd>
          </div>
        </div>

        <div className={GROUP}>
          <div className={ROW}>
            <dt className="flex items-center gap-1.5 text-sm font-medium text-expense">
              <Icon name="arrowUp" />
              Despesas
            </dt>
            <dd className={BIG}>
              <Money value={totals.expenses.total} />
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm md:flex-col md:gap-1">
            <div className={`${ROW} md:justify-between`}>
              <dt>
                <StatusDot status="PAID">Pago</StatusDot>
              </dt>
              <dd className={MID}>
                <Money value={totals.expenses.paid} />
              </dd>
            </div>
            <div className={`${ROW} md:justify-between`}>
              <dt>
                <StatusDot status="PENDING">Pendente</StatusDot>
              </dt>
              <dd className={MID}>
                <Money value={totals.expenses.pending} />
              </dd>
            </div>
          </div>
        </div>

        <div className={GROUP}>
          <div className={ROW} title="receitas − despesas pagas">
            <dt className="text-sm font-medium text-muted">Saldo realizado</dt>
            <dd className="flex flex-wrap items-baseline gap-x-2">
              <span className={BIG}>
                <Money value={totals.balance.realized} />
              </span>
              <SignIndicator value={totals.balance.realized} />
            </dd>
          </div>
          <p className="hidden text-xs text-muted md:block">receitas − despesas pagas</p>
          <div className={ROW} title="receitas − todas as despesas">
            <dt className="text-sm font-medium text-muted">Saldo previsto</dt>
            <dd className="flex flex-wrap items-baseline gap-x-2">
              <span className={MID}>
                <Money value={totals.balance.projected} />
              </span>
              <SignIndicator value={totals.balance.projected} />
            </dd>
          </div>
          <p className="hidden text-xs text-muted md:block">receitas − todas as despesas</p>
        </div>
      </dl>
      {isEmpty(totals) ? <p className="mt-3 text-sm text-muted">Sem lançamentos neste mês</p> : null}
    </section>
  );
}

export function MonthSummarySkeleton() {
  return (
    <div aria-busy="true" className="card p-4 md:grid md:grid-cols-3 md:gap-4 md:border-0 md:bg-transparent md:p-0">
      <span className="sr-only">Carregando resumo do mês</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 py-2 md:card md:p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-40" />
        </div>
      ))}
    </div>
  );
}
