import { Suspense } from "react";
import { MonthSummary, MonthSummarySkeleton } from "@/components/month-summary";
import { BlockErrorBoundary } from "@/components/ui/block-error-boundary";
import { UpdatingRegion } from "@/components/navigation";
import { monthLongPtBR } from "@/lib/dates/format";
import { createFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import type { EntriesState } from "@/lib/filters/entries-search-params";
import { EntriesMonthPicker } from "./entries-month-picker";
import { HEADER_CONTROLS_ID } from "./entries-tabs-bar";
import { NewEntryButton, NewInstallmentButton } from "./entry-drawer-context";

async function SummaryBlock({ month, reader }: { month: string; reader: FinanceReader }) {
  const { totals } = await reader.getSummary(month);
  return <MonthSummary month={month} totals={totals} headingId="entries-summary-heading" />;
}

/**
 * Cabecalho comum de todas as abas (D16): titulo, "+ Novo lancamento", seletor de mes e resumo do MES INTEIRO.
 * O resumo nunca depende de aba, filtros ou pagina (CA47) e carrega/atualiza/falha sozinho (RF24).
 */
export function EntriesHeader({ state, currentMonth, reader = createFinanceReader("protected") }: { state: EntriesState; currentMonth: string; reader?: FinanceReader }) {
  return (
    <header className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
      <div id={HEADER_CONTROLS_ID} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Lançamentos</h1>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row lg:order-2">
            <NewEntryButton className="w-full sm:w-auto" />
            <NewInstallmentButton className="w-full sm:w-auto" />
          </div>
          <div className="lg:order-1">
            <EntriesMonthPicker state={state} currentMonth={currentMonth} />
          </div>
        </div>
      </div>
      <UpdatingRegion scope="summary" className="pt-1">
        <BlockErrorBoundary message="Não foi possível carregar o resumo do mês." compact>
          <Suspense fallback={<MonthSummarySkeleton />}>
            <SummaryBlock month={state.month} reader={reader} />
          </Suspense>
        </BlockErrorBoundary>
        <p className="sr-only" aria-live="polite">
          Mostrando {monthLongPtBR(state.month)}
        </p>
      </UpdatingRegion>
    </header>
  );
}
