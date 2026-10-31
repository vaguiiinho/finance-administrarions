import { EmptyState } from "@/components/ui/states";
import { NavLink } from "@/components/navigation";
import { Pagination } from "@/components/ui/pagination";
import { monthLongPtBR } from "@/lib/dates/format";
import { countLabel } from "@/lib/entries/feedback";
import { changeFilter, changePage, clearExpenseFilters, entriesHref, hasExpenseFilters, toApiQuery, type EntriesState } from "@/lib/filters/entries-search-params";
import { PROTECTED_MODE, type AppMode } from "@/lib/app-mode";
import { createFinanceReader, type FinanceReader } from "@/lib/api/finance-reader";
import { isBadRequest, settle } from "@/lib/api/queries";
import type { ExpensesPage } from "@/lib/api/types";
import { ExpenseFilters } from "./expense-filters";
import { ExpensesList } from "./expenses-list";
import { NewEntryButton } from "./entry-drawer-context";
import { ExpensesSubtotal } from "./tab-subtotal";

import { PANEL_TITLE_ID } from "./panel-ids";

export function InvalidFilters({ state, basePath = "" }: { state: EntriesState; basePath?: "" | "/demo" }) {
  const clear = state.tab === "income" ? changeFilter(state, { r_category: undefined }) : clearExpenseFilters(state);
  return (
    <div role="alert" className="card flex flex-wrap items-center gap-3 p-6">
      <p className="flex-1 text-text">Os filtros da URL são inválidos.</p>
      <NavLink href={entriesHref(clear, basePath)} className="btn" focusId={PANEL_TITLE_ID}>
        Limpar filtros
      </NavLink>
    </div>
  );
}

/** Descricao do vazio com filtros por status (design 5.1); nao promete que ha itens fora do filtro (DL8). */
function filteredEmptyDescription(state: EntriesState): string {
  const { status, category, card } = state.expenses;
  const tail = '"Limpar filtros" mostra todo o mês.';
  if (category || card) return `Nenhuma despesa atende a esta combinação. ${tail}`;
  return `Não há despesas ${status === "PAID" ? "pagas" : "pendentes"} neste mês. ${tail}`;
}

function announce(state: EntriesState, page: ExpensesPage): string {
  const parts = [`Mostrando ${countLabel(page.pagination.totalItems, "despesa", "despesas")} de ${monthLongPtBR(state.month)}`];
  // "Todos" nao tem qualificador: nunca e lido como "pagas" (design 10.2, R8)
  if (state.expenses.status !== "ALL") parts.push(state.expenses.status === "PENDING" ? "pendentes" : "pagas");
  if (state.expenses.category) parts.push(state.expenses.category);
  if (state.expenses.card) parts.push(state.expenses.card === "pix" ? "PIX" : "cartão filtrado");
  return parts.join(", ");
}

/** Painel da aba Despesas (RF20): filtros, subtotal (da API), lista, paginacao e vazios (3.12). */
export async function ExpensesPanel({ state, reader = createFinanceReader("protected"), mode = PROTECTED_MODE }: { state: EntriesState; reader?: FinanceReader; mode?: AppMode }) {
  const { basePath } = mode;
  const pagePromise = reader.listExpenses(toApiQuery(state));
  const categoriesPromise = settle(reader.listCategories());
  const cardsPromise = settle(reader.listCards());
  // se a pagina falhar primeiro (inclusive redirect para o login), estas leituras nao podem virar "unhandled rejection"
  void categoriesPromise.catch(() => undefined);
  void cardsPromise.catch(() => undefined);
  let page: ExpensesPage;
  try {
    page = await pagePromise;
  } catch (error) {
    if (isBadRequest(error)) return <InvalidFilters state={state} basePath={basePath} />;
    throw error;
  }
  const [categories, cardsResult] = await Promise.all([categoriesPromise, cardsPromise]);
  const cards = cardsResult.ok ? cardsResult.data.items : [];
  const filtered = hasExpenseFilters(state);
  const { items, pagination, subtotal } = page;
  const monthLabel = monthLongPtBR(state.month);
  const cardMissing = Boolean(cardsResult.ok && state.expenses.card && state.expenses.card !== "pix" && !cards.some((c) => c.id === state.expenses.card));
  const listKey = `${state.month}|${state.page}|${state.expenses.status}|${state.expenses.category ?? ""}|${state.expenses.card ?? ""}`;

  let body;
  if (items.length === 0 && pagination.totalItems > 0) {
    body = (
      <EmptyState title="Esta página não existe.">
        <NavLink href={entriesHref(changePage(state, Math.max(1, pagination.totalPages)), basePath)} className="btn" focusId={PANEL_TITLE_ID}>
          Ir para a última página
        </NavLink>
      </EmptyState>
    );
  } else if (items.length === 0 && cardMissing) {
    body = (
      <EmptyState title="Este cartão não foi encontrado.">
        <NavLink href={entriesHref(changeFilter(state, { d_card: undefined }), basePath)} className="btn" focusId={PANEL_TITLE_ID}>
          Remover filtro de cartão
        </NavLink>
      </EmptyState>
    );
  } else if (items.length === 0) {
    body = filtered ? (
      <EmptyState title={`Nenhuma despesa para os filtros selecionados em ${monthLabel}`} description={filteredEmptyDescription(state)}>
        <NavLink href={entriesHref(clearExpenseFilters(state), basePath)} className="btn" focusId={PANEL_TITLE_ID}>
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
        <ExpensesList key={listKey} items={items} panelTitleId={PANEL_TITLE_ID} statusFilter={state.expenses.status} />
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          noun="despesas"
          hrefFor={(p) => entriesHref(changePage(state, p), basePath)}
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
