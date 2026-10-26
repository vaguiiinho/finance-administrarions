import { EmptyState } from "@/components/ui/states";
import { NavLink } from "@/components/navigation";
import { Pagination } from "@/components/ui/pagination";
import { monthLongPtBR } from "@/lib/dates/format";
import { countLabel } from "@/lib/entries/feedback";
import { changeFilter, changePage, entriesHref, hasExpenseFilters, toApiQuery, type EntriesState } from "@/lib/filters/entries-search-params";
import { listExpenses } from "@/lib/api/endpoints";
import { isBadRequest, listCardsCached, listCategoriesCached, settle } from "@/lib/api/queries";
import type { ExpensesPage } from "@/lib/api/types";
import { ExpenseFilters } from "./expense-filters";
import { ExpensesList } from "./expenses-list";
import { NewEntryButton } from "./entry-drawer-context";
import { ExpensesSubtotal } from "./tab-subtotal";

export const PANEL_TITLE_ID = "entries-panel-title";
const CLEAR_EXPENSE_FILTERS = { d_status: undefined, d_category: undefined, d_card: undefined } as const;

export function InvalidFilters({ state }: { state: EntriesState }) {
  const clear = state.tab === "income" ? changeFilter(state, { r_category: undefined }) : changeFilter(state, CLEAR_EXPENSE_FILTERS);
  return (
    <div role="alert" className="card flex flex-wrap items-center gap-3 p-6">
      <p className="flex-1 text-text">Os filtros da URL são inválidos.</p>
      <NavLink href={entriesHref(clear)} className="btn" focusId={PANEL_TITLE_ID}>
        Limpar filtros
      </NavLink>
    </div>
  );
}

function announce(state: EntriesState, page: ExpensesPage): string {
  const parts = [`Mostrando ${countLabel(page.pagination.totalItems, "despesa", "despesas")} de ${monthLongPtBR(state.month)}`];
  if (state.expenses.status) parts.push(state.expenses.status === "PENDING" ? "pendentes" : "pagas");
  if (state.expenses.category) parts.push(state.expenses.category);
  if (state.expenses.card) parts.push(state.expenses.card === "pix" ? "PIX" : "cartão filtrado");
  return parts.join(", ");
}

/** Painel da aba Despesas (RF20): filtros, subtotal (da API), lista, paginacao e vazios (3.12). */
export async function ExpensesPanel({ state }: { state: EntriesState }) {
  const pagePromise = listExpenses(toApiQuery(state));
  const categoriesPromise = settle(listCategoriesCached());
  const cardsPromise = settle(listCardsCached());
  let page: ExpensesPage;
  try {
    page = await pagePromise;
  } catch (error) {
    if (isBadRequest(error)) return <InvalidFilters state={state} />;
    throw error;
  }
  const [categories, cardsResult] = await Promise.all([categoriesPromise, cardsPromise]);
  const cards = cardsResult.ok ? cardsResult.data.items : [];
  const filtered = hasExpenseFilters(state);
  const { items, pagination, subtotal } = page;
  const monthLabel = monthLongPtBR(state.month);
  const cardMissing = Boolean(cardsResult.ok && state.expenses.card && state.expenses.card !== "pix" && !cards.some((c) => c.id === state.expenses.card));
  const listKey = `${state.month}|${state.page}|${state.expenses.status ?? ""}|${state.expenses.category ?? ""}|${state.expenses.card ?? ""}`;

  let body;
  if (items.length === 0 && pagination.totalItems > 0) {
    body = (
      <EmptyState title="Esta página não existe.">
        <NavLink href={entriesHref(changePage(state, Math.max(1, pagination.totalPages)))} className="btn" focusId={PANEL_TITLE_ID}>
          Ir para a última página
        </NavLink>
      </EmptyState>
    );
  } else if (items.length === 0 && cardMissing) {
    body = (
      <EmptyState title="Este cartão não foi encontrado.">
        <NavLink href={entriesHref(changeFilter(state, { d_card: undefined }))} className="btn" focusId={PANEL_TITLE_ID}>
          Remover filtro de cartão
        </NavLink>
      </EmptyState>
    );
  } else if (items.length === 0) {
    body = filtered ? (
      <EmptyState title={`Nenhuma despesa para os filtros selecionados em ${monthLabel}`}>
        <NavLink href={entriesHref(changeFilter(state, CLEAR_EXPENSE_FILTERS))} className="btn" focusId={PANEL_TITLE_ID}>
          Limpar filtros
        </NavLink>
        <NewEntryButton variant="primary" />
      </EmptyState>
    ) : (
      <EmptyState title={`Nenhuma despesa em ${monthLabel}`} description="Registre uma despesa ou escolha outro mês.">
        <NewEntryButton variant="primary" />
      </EmptyState>
    );
  } else {
    body = (
      <>
        <ExpensesList key={listKey} items={items} panelTitleId={PANEL_TITLE_ID} />
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          noun="despesas"
          hrefFor={(p) => entriesHref(changePage(state, p))}
          focusId={PANEL_TITLE_ID}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite">
        {announce(state, page)}
      </p>
      <ExpenseFilters
        state={state}
        categories={categories.ok ? categories.data.items : []}
        categoriesError={!categories.ok}
        cards={cards}
        cardsError={!cardsResult.ok}
      />
      <ExpensesSubtotal count={pagination.totalItems} totals={subtotal} filtered={filtered} />
      {body}
    </div>
  );
}
