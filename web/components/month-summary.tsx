import { monthLongPtBR } from "@/lib/dates/format";
import { toCents } from "@/lib/money/decimal";
import type { TotalsDto } from "@/lib/api/types";
import { Money } from "./ui/money";
import { Icon, SignIndicator, StatusDot } from "./ui/status";
import { Skeleton } from "./ui/states";

/* Constantes de layout COMPARTILHADAS com o skeleton (ADR 0004 5.7): o resumo e o esqueleto nao podem divergir (CLS). */
const SUMMARY_ROOT = "flex flex-col gap-2";
const SUMMARY_TITLE = "text-sm font-medium leading-5 text-muted";
const SUMMARY_GRID = "grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4";
/* Card de vidro: rotulo a esquerda e valor a direita no mobile; a partir de md o par principal empilha (dt sobre dd). */
const SUMMARY_CARD = "card grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3 md:content-start md:p-4";

const MAIN_DT = "flex items-center gap-1.5 text-sm font-medium leading-6 md:col-span-2 md:leading-5";
const MAIN_DD = "display-num text-right text-base font-semibold leading-6 text-text md:col-span-2 md:text-left md:text-2xl md:leading-8 lg:text-[28px] lg:leading-9";
const SUB_DT = "text-sm leading-6 md:leading-7";
const SUB_DD = "display-num text-right text-base font-semibold leading-6 text-text md:text-lg md:leading-7";
const SUB_FIRST = "md:mt-2";
const HINT = "hidden basis-full text-xs leading-4 text-muted md:block";

const isEmpty = (t: TotalsDto) => [t.income, t.expenses.total, t.expenses.paid, t.expenses.pending].every((v) => toCents(v) === 0n);

/**
 * Resumo do mes inteiro (RF10, D10/D20): 3 cards de vidro soltos (Receitas; Despesas total/pago/pendente; Saldo realizado/previsto),
 * sem card externo. Um unico layout em todos os breakpoints; os valores vem da API (nunca calculados aqui).
 */
export function MonthSummary({ month, totals, headingId }: { month: string; totals: TotalsDto; headingId: string }) {
  return (
    <section aria-labelledby={headingId} className={SUMMARY_ROOT}>
      <h2 id={headingId} className={SUMMARY_TITLE}>
        Resumo de {monthLongPtBR(month)}
      </h2>
      <dl className={SUMMARY_GRID}>
        <div className={SUMMARY_CARD}>
          <dt className={`${MAIN_DT} text-income`}>
            <Icon name="arrowIn" />
            Receitas
          </dt>
          <dd className={MAIN_DD}>
            <Money value={totals.income} />
          </dd>
        </div>

        <div className={SUMMARY_CARD}>
          <dt className={`${MAIN_DT} text-expense`}>
            <Icon name="arrowUp" />
            Despesas
          </dt>
          <dd className={MAIN_DD}>
            <Money value={totals.expenses.total} />
          </dd>
          <dt className={`${SUB_DT} ${SUB_FIRST}`}>
            <StatusDot status="PAID">Pago</StatusDot>
          </dt>
          <dd className={`${SUB_DD} ${SUB_FIRST}`}>
            <Money value={totals.expenses.paid} />
          </dd>
          <dt className={SUB_DT}>
            <StatusDot status="PENDING">Pendente</StatusDot>
          </dt>
          <dd className={SUB_DD}>
            <Money value={totals.expenses.pending} />
          </dd>
        </div>

        <div className={SUMMARY_CARD}>
          <dt className={`${MAIN_DT} text-muted`}>Saldo realizado</dt>
          <dd className={`${MAIN_DD} flex min-h-11 flex-wrap items-baseline justify-end gap-x-2 md:min-h-0 md:justify-start`} title="receitas − despesas pagas">
            <span>
              <Money value={totals.balance.realized} />
            </span>
            <SignIndicator value={totals.balance.realized} />
            <span className={HINT}>receitas − despesas pagas</span>
          </dd>
          <dt className={`text-sm leading-6 text-muted ${SUB_FIRST} md:col-span-2 md:leading-5`}>Saldo previsto</dt>
          <dd className={`${SUB_DD} flex min-h-11 flex-wrap items-baseline justify-end gap-x-2 text-right md:col-span-2 md:min-h-0`} title="receitas − todas as despesas">
            <span>
              <Money value={totals.balance.projected} />
            </span>
            <SignIndicator value={totals.balance.projected} />
            <span className={`${HINT} text-right`}>receitas − todas as despesas</span>
          </dd>
        </div>
      </dl>
      {isEmpty(totals) ? <p className="mt-1 text-sm leading-5 text-muted">Sem lançamentos neste mês</p> : null}
    </section>
  );
}

/**
 * Linha do esqueleto: mesmas alturas de linha do resumo real (mobile 24px; md: principal 32/36px, secundaria 28px).
 * `stacked`: rotulo sobre o valor com dica de formula (+16px), como o "Saldo previsto" a partir de md.
 * `tall`: as linhas do Saldo reservam 44px no mobile (min-h-11 no componente real), pois o indicador de sinal desce para uma 2a linha em 360px com valores comuns; assim nao ha CLS com valores curtos.
 */
function SkeletonRow({ main, stacked, hint = false, first = false, tall = false }: { main?: boolean; stacked?: boolean; hint?: boolean; first?: boolean; tall?: boolean }) {
  const span = main || stacked;
  const label = `${span ? "md:col-span-2 md:h-5" : "md:h-7"} ${first ? "md:mt-2" : ""}`;
  const value = main
    ? `md:col-span-2 md:justify-start ${hint ? "md:h-12 lg:h-13" : "md:h-8 lg:h-9"}`
    : stacked
      ? "md:col-span-2 md:h-11"
      : `md:h-7 ${first ? "md:mt-2" : ""}`;
  return (
    <>
      <div className={`flex h-6 items-center ${label}`}>
        <Skeleton className={main ? "h-3.5 w-24" : "h-3.5 w-16"} />
      </div>
      <div className={`flex justify-end ${tall ? "h-11 items-start" : "h-6 items-center"} ${value}`}>
        <Skeleton className={main ? "h-4 w-28 md:h-6 md:w-40" : "h-4 w-24 md:h-[18px]"} />
      </div>
    </>
  );
}

export function MonthSummarySkeleton() {
  return (
    <div aria-busy="true" className={SUMMARY_ROOT}>
      <span className="sr-only">Carregando resumo do mês</span>
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className={SUMMARY_GRID}>
        <div className={SUMMARY_CARD}>
          <SkeletonRow main />
        </div>
        <div className={SUMMARY_CARD}>
          <SkeletonRow main />
          <SkeletonRow first />
          <SkeletonRow />
        </div>
        <div className={SUMMARY_CARD}>
          <SkeletonRow main hint tall />
          <SkeletonRow stacked first tall />
        </div>
      </div>
    </div>
  );
}
