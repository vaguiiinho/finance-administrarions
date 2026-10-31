import { currentYearMonthSP, isYearMonth } from "@/lib/dates/format";

/**
 * Estado da tela /entries na URL (ADR 9.3): month, tab, d_status, d_category, d_card, r_category, page.
 * Funcoes puras: o servidor le (parse), os componentes montam links (serialize/change*), a pagina chama a API (toApiQuery).
 */
export type EntriesTab = "expenses" | "invoices" | "income";
/** ADR 0007 7.1: filtro de status de Despesas (`d_status`) e de Faturas (`f_status`). Ausente ou invalido = PENDING. */
export type StatusFilter = "ALL" | "PENDING" | "PAID";
export const DEFAULT_STATUS_FILTER: StatusFilter = "PENDING";
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ExpenseFilters {
  /** Obrigatorio: "ausente = Todos" deixou de existir (ADR 0007 S1, R8). */
  status: StatusFilter;
  category?: string;
  /** UUID do cartao ou "pix" */
  card?: string;
}

export interface InvoiceFilters {
  status: StatusFilter;
}

export interface IncomeFilters {
  category?: string;
}

export interface EntriesState {
  month: string;
  monthWasInvalid: boolean;
  tab: EntriesTab;
  page: number;
  expenses: ExpenseFilters;
  invoices: InvoiceFilters;
  incomes: IncomeFilters;
}

export type FilterPatch = Partial<{
  d_status: StatusFilter;
  f_status: StatusFilter;
  d_category: string | undefined;
  d_card: string | undefined;
  r_category: string | undefined;
}>;

const TABS: readonly EntriesTab[] = ["expenses", "invoices", "income"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseStatus(value: string | undefined): StatusFilter {
  return value === "PENDING" || value === "PAID" || value === "ALL" ? value : DEFAULT_STATUS_FILTER;
}

function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export function parseEntriesSearchParams(raw: RawSearchParams, now: Date = new Date()): EntriesState {
  const rawMonth = first(raw.month);
  const monthValid = rawMonth !== undefined && isYearMonth(rawMonth);
  const tabRaw = first(raw.tab);
  const card = first(raw.d_card);
  return {
    month: monthValid ? rawMonth : currentYearMonthSP(now),
    monthWasInvalid: rawMonth !== undefined && !monthValid,
    tab: TABS.includes(tabRaw as EntriesTab) ? (tabRaw as EntriesTab) : "expenses",
    page: parsePage(first(raw.page)),
    expenses: {
      status: parseStatus(first(raw.d_status)),
      ...(nonEmpty(first(raw.d_category)) ? { category: nonEmpty(first(raw.d_category)) } : {}),
      ...(card === "pix" || (card && UUID_RE.test(card)) ? { card } : {}),
    },
    invoices: { status: parseStatus(first(raw.f_status)) },
    incomes: nonEmpty(first(raw.r_category)) ? { category: nonEmpty(first(raw.r_category)) } : {},
  };
}

/** Query string (sem "?"). Sempre carrega o mes; omite aba Despesas, pagina 1 e filtros vazios. */
export function serializeEntriesState(state: EntriesState): string {
  const q = new URLSearchParams();
  q.set("month", state.month);
  if (state.tab !== "expenses") q.set("tab", state.tab);
  if (state.expenses.status !== DEFAULT_STATUS_FILTER) q.set("d_status", state.expenses.status);
  if (state.invoices.status !== DEFAULT_STATUS_FILTER) q.set("f_status", state.invoices.status);
  if (state.expenses.category) q.set("d_category", state.expenses.category);
  if (state.expenses.card) q.set("d_card", state.expenses.card);
  if (state.incomes.category) q.set("r_category", state.incomes.category);
  if (state.page > 1) q.set("page", String(state.page));
  return q.toString();
}

/** Href da tela para um estado (a aba Despesas explicita `tab=expenses` nao e necessaria). */
export function entriesHref(state: EntriesState, basePath: "" | "/demo" = ""): string {
  return `${basePath}/entries?${serializeEntriesState(state)}`;
}

export function changeTab(state: EntriesState, tab: EntriesTab): EntriesState {
  return { ...state, tab, page: 1 };
}

export function changeMonth(state: EntriesState, month: string): EntriesState {
  return { ...state, month, monthWasInvalid: false, page: 1 };
}

export function changePage(state: EntriesState, page: number): EntriesState {
  return { ...state, page };
}

/** Aplica um patch de filtros (categoria/cartao/r_category: undefined remove; status e sempre explicito) e volta para a pagina 1. */
export function changeFilter(state: EntriesState, patch: FilterPatch): EntriesState {
  const expenses = { ...state.expenses };
  const incomes = { ...state.incomes };
  const invoices = { ...state.invoices };
  if (patch.d_status) expenses.status = patch.d_status;
  if (patch.f_status) invoices.status = patch.f_status;
  if ("d_category" in patch) {
    if (patch.d_category) expenses.category = patch.d_category;
    else delete expenses.category;
  }
  if ("d_card" in patch) {
    if (patch.d_card) expenses.card = patch.d_card;
    else delete expenses.card;
  }
  if ("r_category" in patch) {
    if (patch.r_category) incomes.category = patch.r_category;
    else delete incomes.category;
  }
  return { ...state, expenses, invoices, incomes, page: 1 };
}

/** Mapeamento para E2/E3/I1 (ADR 9.3): d_status->status, d_category->category, d_card->cardId, page->page. */
export function toApiQuery(state: EntriesState): Record<string, string> {
  const query: Record<string, string> = { month: state.month };
  if (state.tab === "expenses") {
    if (state.expenses.status !== "ALL") query.status = state.expenses.status;
    if (state.expenses.category) query.category = state.expenses.category;
    if (state.expenses.card) query.cardId = state.expenses.card;
    if (state.page > 1) query.page = String(state.page);
  } else if (state.tab === "invoices") {
    if (state.invoices.status !== "ALL") query.status = state.invoices.status;
  } else if (state.tab === "income") {
    if (state.incomes.category) query.category = state.incomes.category;
    if (state.page > 1) query.page = String(state.page);
  }
  return query;
}

/** O padrao PENDING conta como filtro ativo (RF11, CA37): so "Todos" sem categoria nem cartao e "sem filtros". */
export function hasExpenseFilters(state: EntriesState): boolean {
  return Boolean(state.expenses.status !== "ALL" || state.expenses.category || state.expenses.card);
}

/** "Limpar filtros" de Despesas (ponto unico, ADR 0007 7.1): status ALL, sem categoria nem cartao. */
export function clearExpenseFilters(state: EntriesState): EntriesState {
  return { ...state, expenses: { status: "ALL" }, page: 1 };
}

/** "Limpar filtros" de Faturas: status ALL; Despesas nao muda (RF19). */
export function clearInvoiceFilters(state: EntriesState): EntriesState {
  return { ...state, invoices: { status: "ALL" }, page: 1 };
}
