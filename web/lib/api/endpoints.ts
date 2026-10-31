import "server-only";
import type { InitialMonthDecision } from "@/lib/filters/initial-month";
import { apiGet, apiPost, apiPut, request } from "./http";
import type {
  CardDto,
  CardPayload,
  CategoryDistribution,
  CreateEntryPayload,
  EntryDto,
  ExpensesPage,
  IncomesPage,
  InvoiceDto,
  MonthlySeries,
  PayEntriesResult,
  PayInvoiceResult,
  TotalsDto,
} from "./types";

/** Uma funcao por endpoint do ADR 6.2 (S1, C1-C3, I1-I3, E1-E6, D2, D3). */
export const getSummary = (month: string) => apiGet<{ month: string; totals: TotalsDto }>("/summary", { month });
export const listCards = () => apiGet<{ items: CardDto[] }>("/cards");
export const createCardRequest = (payload: CardPayload) => apiPost<CardDto>("/cards", payload);
export const updateCardRequest = (id: string, payload: CardPayload) => apiPut<CardDto>(`/cards/${encodeURIComponent(id)}`, payload);
export const listCategories = () => apiGet<{ items: string[] }>("/categories");
/** `status` ausente = todas as faturas; `ALL` nunca chega a API (ADR 0007 6.2). */
export interface InvoiceQuery {
  month: string;
  status?: "PENDING" | "PAID";
}
export const listInvoices = (query: InvoiceQuery) => apiGet<{ month: string; items: InvoiceDto[] }>("/invoices", { month: query.month, status: query.status });
/** Mes inicial (ADR 0007 6.1): so essa leitura tem timeout, para uma API travada nao prender o skeleton. */
export const INITIAL_MONTH_TIMEOUT_MS = 1500;
export const getInitialMonth = () => request<InitialMonthDecision>("GET", "/entries/initial-month", { timeoutMs: INITIAL_MONTH_TIMEOUT_MS });
export const listInvoiceEntries = (cardId: string, referenceMonth: string) =>
  apiGet<{ card: { id: string; name: string }; referenceMonth: string; items: EntryDto[] }>(`/cards/${encodeURIComponent(cardId)}/invoices/${encodeURIComponent(referenceMonth)}/entries`);
export const payInvoiceRequest = (cardId: string, referenceMonth: string) =>
  apiPost<PayInvoiceResult>(`/cards/${encodeURIComponent(cardId)}/invoices/${encodeURIComponent(referenceMonth)}/pay`);
export const listExpenses = (query: Record<string, string>) => apiGet<ExpensesPage>("/entries/expenses", query);
export const listIncomes = (query: Record<string, string>) => apiGet<IncomesPage>("/entries/incomes", query);
export const createEntryRequest = (payload: CreateEntryPayload) => apiPost<EntryDto>("/entries", payload);
export const payEntryRequest = (id: string) => apiPost<EntryDto>(`/entries/${encodeURIComponent(id)}/pay`);
export const payEntriesRequest = (ids: string[]) => apiPost<PayEntriesResult>("/entries/pay", { ids });
export const getMonthlySeries = (month: string) => apiGet<MonthlySeries>("/dashboard/monthly-series", { month });
export const getCategoryDistribution = (month: string) => apiGet<CategoryDistribution>("/dashboard/category-distribution", { month });
