import { Suspense } from "react";
import { type AppMode } from "@/lib/app-mode";
import { AppModeProvider } from "@/components/app-mode";
import { UpdatingRegion } from "@/components/navigation";
import { BlockErrorBoundary } from "@/components/ui/block-error-boundary";
import type { FinanceReader } from "@/lib/api/finance-reader";
import { currentYearMonthSP, monthLongPtBR } from "@/lib/dates/format";
import { parseEntriesSearchParams, type EntriesTab } from "@/lib/filters/entries-search-params";
import { EntriesHeader } from "./_components/entries-header";
import { EntriesTabsBar } from "./_components/entries-tabs-bar";
import { EntryDrawerHost } from "./_components/entry-drawer-host";
import { EntryDrawerProvider } from "./_components/entry-drawer-context";
import { ExpensesPanel, PANEL_TITLE_ID } from "./_components/expenses-panel";
import { IncomePanel } from "./_components/income-panel";
import { InvoicesPanel } from "./_components/invoices-panel";
import { InvoicesPanelSkeleton, ListPanelSkeleton } from "./_components/panel-skeletons";
import { MonthNotice } from "./_components/month-notice";

const TAB_TITLES: Record<EntriesTab, string> = { expenses: "Despesas", invoices: "Faturas", income: "Receitas" };
const TAB_ERRORS: Record<EntriesTab, string> = {
  expenses: "Não foi possível carregar as despesas.",
  invoices: "Não foi possível carregar as faturas.",
  income: "Não foi possível carregar as receitas.",
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Tela de lancamentos (ADR 0005 9.6): a mesma no protegido e na demo. O drawer de "Novo lancamento" (escrita) so e montado
 * fora da demo; os botoes de escrita somem sozinhos em `readOnly` (`WriteOnly`).
 */
export function EntriesScreen({ searchParams, mode, reader }: { searchParams: SearchParams; mode: AppMode; reader: FinanceReader }) {
  const state = parseEntriesSearchParams(searchParams);
  const currentMonth = currentYearMonthSP();

  return (
    <AppModeProvider mode={mode}>
      <EntryDrawerProvider>
        {state.monthWasInvalid ? <MonthNotice /> : null}
        <EntriesHeader state={state} currentMonth={currentMonth} reader={reader} />
        <EntriesTabsBar state={state} currentMonth={currentMonth} />
        <section role="tabpanel" id={`entries-panel-${state.tab}`} aria-labelledby={`entries-tab-${state.tab}`} className="pt-4 md:pt-6">
          <h2 id={PANEL_TITLE_ID} tabIndex={-1} className="mb-4 font-display text-xl font-semibold text-text">
            {TAB_TITLES[state.tab]} de {monthLongPtBR(state.month)}
          </h2>
          <UpdatingRegion scope="panel" className="pt-1">
            <BlockErrorBoundary key={state.tab} message={TAB_ERRORS[state.tab]}>
              {/* Primeira visita a outra aba: skeleton so do painel (key por aba); mes/filtro/pagina mantem o conteudo ate chegar o novo */}
              <Suspense key={state.tab} fallback={state.tab === "invoices" ? <InvoicesPanelSkeleton /> : <ListPanelSkeleton />}>
                {state.tab === "expenses" ? <ExpensesPanel state={state} reader={reader} mode={mode} /> : state.tab === "invoices" ? <InvoicesPanel state={state} reader={reader} mode={mode} /> : <IncomePanel state={state} reader={reader} mode={mode} />}
              </Suspense>
            </BlockErrorBoundary>
          </UpdatingRegion>
        </section>
        {mode.readOnly ? null : (
          <Suspense fallback={null}>
            <EntryDrawerHost state={state} reader={reader} />
          </Suspense>
        )}
      </EntryDrawerProvider>
    </AppModeProvider>
  );
}
