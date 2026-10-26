import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatingRegion } from "@/components/navigation";
import { BlockErrorBoundary } from "@/components/ui/block-error-boundary";
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

export const metadata: Metadata = { title: "Lançamentos" };

const TAB_TITLES: Record<EntriesTab, string> = { expenses: "Despesas", invoices: "Faturas", income: "Receitas" };
const TAB_ERRORS: Record<EntriesTab, string> = {
  expenses: "Não foi possível carregar as despesas.",
  invoices: "Não foi possível carregar as faturas.",
  income: "Não foi possível carregar as receitas.",
};

export default async function EntriesPage(props: PageProps<"/entries">) {
  const state = parseEntriesSearchParams(await props.searchParams);
  const currentMonth = currentYearMonthSP();

  return (
    <EntryDrawerProvider>
      {state.monthWasInvalid ? <MonthNotice /> : null}
      <EntriesHeader state={state} currentMonth={currentMonth} />
      <EntriesTabsBar state={state} currentMonth={currentMonth} />
      <section role="tabpanel" id={`entries-panel-${state.tab}`} aria-labelledby={`entries-tab-${state.tab}`} className="pt-4 md:pt-6">
        <h2 id={PANEL_TITLE_ID} tabIndex={-1} className="mb-4 font-display text-xl font-semibold text-text">
          {TAB_TITLES[state.tab]} de {monthLongPtBR(state.month)}
        </h2>
        <UpdatingRegion scope="panel" className="pt-1">
          <BlockErrorBoundary key={state.tab} message={TAB_ERRORS[state.tab]}>
            {/* Primeira visita a outra aba: skeleton so do painel (key por aba); mes/filtro/pagina mantem o conteudo ate chegar o novo */}
            <Suspense key={state.tab} fallback={state.tab === "invoices" ? <InvoicesPanelSkeleton /> : <ListPanelSkeleton />}>
              {state.tab === "expenses" ? <ExpensesPanel state={state} /> : state.tab === "invoices" ? <InvoicesPanel state={state} /> : <IncomePanel state={state} />}
            </Suspense>
          </BlockErrorBoundary>
        </UpdatingRegion>
      </section>
      <Suspense fallback={null}>
        <EntryDrawerHost state={state} />
      </Suspense>
    </EntryDrawerProvider>
  );
}
