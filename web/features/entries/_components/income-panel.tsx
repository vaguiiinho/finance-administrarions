import { EmptyState } from "@/components/ui/states";
import { NavLink } from "@/components/navigation";
import { Pagination } from "@/components/ui/pagination";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status";
import { formatCivilDate, monthLongPtBR } from "@/lib/dates/format";
import { countLabel } from "@/lib/entries/feedback";
import { changeFilter, changePage, entriesHref, toApiQuery, type EntriesState } from "@/lib/filters/entries-search-params";
import { getFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import { isBadRequest, settle } from "@/lib/api/queries";
import type { IncomesPage } from "@/lib/api/types";
import { IncomeFilter } from "./expense-filters";
import { EntryItem, EntryRow, NewEntryButton, RecentBadge } from "./entry-drawer-context";
import { InvalidFilters } from "./expenses-panel";
import { PANEL_TITLE_ID } from "./panel-ids";
import { IncomeSubtotal } from "./tab-subtotal";

/** Painel da aba Receitas (RF22): sem selecao e sem acao (CA71); filtro de categoria; subtotal da API. */
export async function IncomePanel({ state, reader = getFinanceReader() }: { state: EntriesState; reader?: FinanceReader }) {
  const pagePromise = reader.listIncomes(toApiQuery(state));
  const categoriesPromise = settle(reader.listCategories());
  void categoriesPromise.catch(() => undefined); // ver ExpensesPanel
  let page: IncomesPage;
  try {
    page = await pagePromise;
  } catch (error) {
    if (isBadRequest(error)) return <InvalidFilters state={state} />;
    throw error;
  }
  const categories = await categoriesPromise;
  const { items, pagination, subtotal } = page;
  const category = state.incomes.category;
  const monthLabel = monthLongPtBR(state.month);

  let body;
  if (items.length === 0 && pagination.totalItems > 0) {
    body = (
      <EmptyState title="Esta página não existe.">
        <NavLink href={entriesHref(changePage(state, Math.max(1, pagination.totalPages)))} className="btn" focusId={PANEL_TITLE_ID}>
          Ir para a última página
        </NavLink>
      </EmptyState>
    );
  } else if (items.length === 0) {
    body = category ? (
      <EmptyState title={`Nenhuma receita na categoria ${category} em ${monthLabel}`}>
        <NavLink href={entriesHref(changeFilter(state, { r_category: undefined }))} className="btn" focusId={PANEL_TITLE_ID}>
          Limpar filtro
        </NavLink>
      </EmptyState>
    ) : (
      <EmptyState title={`Nenhuma receita em ${monthLabel}`}>
        <NewEntryButton variant="primary" />
      </EmptyState>
    );
  } else {
    body = (
      <>
        <div className="glass-flat hidden overflow-clip rounded-xl md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Receitas do mês, mais recentes primeiro</caption>
          <thead className="sticky top-[calc(var(--navbar-h)+var(--tabsbar-h))] z-10 glass-bar text-left text-muted">
            <tr className="border-b border-border-strong">
              <th scope="col" className="px-3 py-3 font-medium">Descrição</th>
              <th scope="col" className="px-3 py-3 font-medium">Categoria</th>
              <th scope="col" className="px-3 py-3 font-medium">Data</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Valor</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <EntryRow key={entry.id} id={entry.id} className="min-h-14 border-b border-border hover:bg-card-2">
                <td className="px-3 py-3 font-medium text-text">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{entry.description}</span>
                    <span className="shrink-0">
                      <RecentBadge id={entry.id} />
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-muted">{entry.category}</td>
                <td className="px-3 py-3 text-text">{formatCivilDate(entry.date)}</td>
                <td className="px-3 py-3 text-right text-text">
                  <Money value={entry.amount} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={entry.status} />
                </td>
              </EntryRow>
            ))}
          </tbody>
        </table>
        </div>
        <ul className="flex flex-col gap-3 md:hidden">
          {items.map((entry) => (
            <EntryItem key={entry.id} id={entry.id} className="glass-flat flex flex-col gap-1 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 font-medium text-text">
                  <span className="truncate">{entry.description}</span>
                  <span className="shrink-0">
                    <RecentBadge id={entry.id} />
                  </span>
                </p>
                <StatusBadge status={entry.status} />
              </div>
              <p className="text-sm text-muted">
                {entry.category} · {formatCivilDate(entry.date)}
              </p>
              <p className="text-right text-base font-semibold text-text">
                <Money value={entry.amount} />
              </p>
            </EntryItem>
          ))}
        </ul>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          noun="receitas"
          hrefFor={(p) => entriesHref(changePage(state, p))}
          focusId={PANEL_TITLE_ID}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        Mostrando {countLabel(pagination.totalItems, "receita", "receitas")} de {monthLabel}
        {category ? `, ${category}` : ""}
      </p>
      <IncomeFilter state={state} categories={categories.ok ? categories.data.items : []} categoriesError={!categories.ok} />
      <IncomeSubtotal count={pagination.totalItems} total={subtotal.total} filtered={Boolean(category)} />
      {body}
    </div>
  );
}
