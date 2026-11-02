import type {
  AuthResponse,
  CardDto,
  CategoryDistribution,
  CreateEntryPayload,
  CreateInstallmentExpensesPayload,
  CurrentUserDto,
  EntryDto,
  ExpenseTotalsDto,
  ExpensesPage,
  IncomesPage,
  InvoiceDto,
  MonthlySeries,
  PayEntriesResult,
  PayInvoiceResult,
  TotalsDto,
  UpdateExpensePayload,
} from '@/lib/api/types';
import type { ApiClient } from './http-client';

export type MonthAdvance = 'NONE' | 'NEXT_PENDING' | 'NO_PENDING_AHEAD';
export interface InitialMonthDecision {
  currentMonth: string;
  month: string;
  advance: MonthAdvance;
}

export type ExpenseFilters = { status?: 'PENDING' | 'PAID'; category?: string; cardId?: string };
export type IncomeFilters = { category?: string };
export const PAGE_SIZE = 20;
export const INITIAL_MONTH_TIMEOUT_MS = 1500;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isDecimal = (v: unknown): v is string => typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function invalid(endpoint: string): never {
  throw new TypeError(`resposta invalida de ${endpoint}`);
}

function isExpenseTotals(v: unknown): v is ExpenseTotalsDto {
  return isRecord(v) && isDecimal(v.total) && isDecimal(v.paid) && isDecimal(v.pending);
}

function isTotals(v: unknown): v is TotalsDto {
  return isRecord(v) && isDecimal(v.income) && isExpenseTotals(v.expenses) && isRecord(v.balance) && isDecimal(v.balance.realized) && isDecimal(v.balance.projected);
}

function isPagination(v: unknown): v is ExpensesPage['pagination'] {
  return isRecord(v) && isCount(v.page) && isCount(v.pageSize) && isCount(v.totalItems) && isCount(v.totalPages);
}

function isEntry(v: unknown): v is EntryDto {
  return isRecord(v) && isStr(v.id) && isStr(v.type) && isStr(v.description) && isStr(v.category) && isStr(v.date) && isDecimal(v.amount) && isStr(v.status);
}

function entryItems(raw: unknown, endpoint: string): EntryDto[] {
  if (!isRecord(raw) || !Array.isArray(raw.items) || !raw.items.every(isEntry)) invalid(endpoint);
  return raw.items;
}

/** Resumo: contrato `{ month, totals }` (docs/api/finance.md). Qualquer outra forma e rejeitada. */
export function parseSummary(raw: unknown): TotalsDto {
  if (!isRecord(raw) || !isStr(raw.month) || !isTotals(raw.totals)) invalid('/api/summary');
  return raw.totals;
}

/** Serie: `{ from, to, points: [{ month, totals }] }`. */
export function parseSeries(raw: unknown): MonthlySeries {
  if (
    !isRecord(raw) ||
    !isStr(raw.from) ||
    !isStr(raw.to) ||
    !Array.isArray(raw.points) ||
    !raw.points.every((p) => isRecord(p) && isStr(p.month) && isTotals(p.totals))
  ) {
    invalid('/api/dashboard/monthly-series');
  }
  return { from: raw.from, to: raw.to, points: raw.points as MonthlySeries['points'] };
}

/** Distribuicao: `{ month, total, items: [{ category, total, percentage }] }`. */
export function parseDistribution(raw: unknown): CategoryDistribution {
  if (
    !isRecord(raw) ||
    !isStr(raw.month) ||
    !isDecimal(raw.total) ||
    !Array.isArray(raw.items) ||
    !raw.items.every((i) => isRecord(i) && isStr(i.category) && isDecimal(i.total) && isDecimal(i.percentage))
  ) {
    invalid('/api/dashboard/category-distribution');
  }
  return { month: raw.month, total: raw.total, items: raw.items as CategoryDistribution['items'] };
}

/** Despesas: `{ month, items, pagination, subtotal: { total, paid, pending } }`. */
export function parseExpensesPage(raw: unknown): ExpensesPage {
  const endpoint = '/api/entries/expenses';
  if (!isRecord(raw) || !isStr(raw.month) || !isPagination(raw.pagination) || !isExpenseTotals(raw.subtotal)) invalid(endpoint);
  return { month: raw.month, items: entryItems(raw, endpoint), pagination: raw.pagination, subtotal: raw.subtotal };
}

/** Receitas: igual as despesas, com `subtotal: { total }`. */
export function parseIncomesPage(raw: unknown): IncomesPage {
  const endpoint = '/api/entries/incomes';
  if (!isRecord(raw) || !isStr(raw.month) || !isPagination(raw.pagination) || !isRecord(raw.subtotal) || !isDecimal(raw.subtotal.total)) invalid(endpoint);
  return { month: raw.month, items: entryItems(raw, endpoint), pagination: raw.pagination, subtotal: { total: raw.subtotal.total } };
}

/** Faturas: `{ month, items: [{ card, referenceMonth, closingDate, dueDate, entryCount, pendingCount, totals }] }`. */
export function parseInvoices(raw: unknown): InvoiceDto[] {
  const ok = (i: unknown): i is InvoiceDto =>
    isRecord(i) &&
    isRecord(i.card) &&
    isStr(i.card.id) &&
    isStr(i.card.name) &&
    isStr(i.referenceMonth) &&
    isStr(i.closingDate) &&
    isStr(i.dueDate) &&
    isCount(i.entryCount) &&
    isCount(i.pendingCount) &&
    isExpenseTotals(i.totals);
  if (!isRecord(raw) || !Array.isArray(raw.items) || !raw.items.every(ok)) invalid('/api/invoices');
  return raw.items as InvoiceDto[];
}

/** Despesas de uma fatura: `{ card, referenceMonth, items }`. */
export function parseInvoiceEntries(raw: unknown): EntryDto[] {
  return entryItems(raw, '/api/cards/:id/invoices/:month/entries');
}

export function parseCategories(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.items) || !raw.items.every(isStr)) invalid('/api/categories');
  return raw.items;
}

export function parseCards(raw: unknown): CardDto[] {
  if (!isRecord(raw) || !Array.isArray(raw.items) || !raw.items.every((c) => isRecord(c) && isStr(c.id) && isStr(c.name))) invalid('/api/cards');
  return raw.items as CardDto[];
}

/** Usuario atual: corpo do presenter da API (sem envelope `user`). */
export function parseCurrentUser(raw: unknown, endpoint = '/api/auth/me'): CurrentUserDto {
  if (
    !isRecord(raw) ||
    !isStr(raw.id) ||
    !isStr(raw.name) ||
    !isStr(raw.email) ||
    !isStr(raw.role) ||
    typeof raw.mustChangePassword !== 'boolean' ||
    !isStr(raw.accountKind) ||
    !Array.isArray(raw.capabilities) ||
    !raw.capabilities.every(isStr)
  ) {
    invalid(endpoint);
  }
  return raw as unknown as CurrentUserDto;
}

const isIsoDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

/** Login: `{ user, session: { token, expiresAt } }`; forma invalida lanca TypeError (nada e gravado). */
export function parseAuthResponse(raw: unknown): AuthResponse {
  const endpoint = '/api/auth/login';
  if (!isRecord(raw) || !isRecord(raw.session) || !isStr(raw.session.token) || raw.session.token === '' || !isIsoDate(raw.session.expiresAt)) invalid(endpoint);
  const user = parseCurrentUser(raw.user, endpoint);
  return { user, session: { token: raw.session.token, expiresAt: raw.session.expiresAt } };
}

const ADVANCES: readonly string[] = ['NONE', 'NEXT_PENDING', 'NO_PENDING_AHEAD'];
const isMonth = (v: unknown): v is string => isStr(v) && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Mes inicial: `{ currentMonth, month, advance }`. */
export function parseInitialMonth(raw: unknown): InitialMonthDecision {
  if (!isRecord(raw) || !isMonth(raw.currentMonth) || !isMonth(raw.month) || !isStr(raw.advance) || !ADVANCES.includes(raw.advance)) invalid('/api/entries/initial-month');
  return { currentMonth: raw.currentMonth, month: raw.month, advance: raw.advance as MonthAdvance };
}

/** Uma funcao por endpoint usado pelo app (ADR 0011 6.5). Sem estado, sem React. */
export function createApi(client: ApiClient) {
  const enc = encodeURIComponent;
  return {
    login: async (email: string, password: string) => parseAuthResponse(await client.post('/api/auth/login', { email, password }, { auth: false })),
    /** Melhor esforco: a falha e ignorada pelo chamador. */
    logout: (token: string) => client.post<void>('/api/auth/logout', {}, { auth: false, token, timeoutMs: 5_000 }),
    me: async () => parseCurrentUser(await client.get('/api/auth/me')),
    changePassword: async (currentPassword: string, newPassword: string) =>
      parseCurrentUser(await client.put('/api/account/password', { currentPassword, newPassword }), '/api/account/password'),
    summary: async (month: string) => parseSummary(await client.get('/api/summary', { month })),
    series: async (month: string) => parseSeries(await client.get('/api/dashboard/monthly-series', { month })),
    categoryDistribution: async (month: string) => parseDistribution(await client.get('/api/dashboard/category-distribution', { month })),
    initialMonth: async () => parseInitialMonth(await client.get('/api/entries/initial-month', undefined, { timeoutMs: INITIAL_MONTH_TIMEOUT_MS })),
    expenses: async (month: string, filters: ExpenseFilters, page: number, signal?: AbortSignal, pageSize = PAGE_SIZE) =>
      parseExpensesPage(await client.get('/api/entries/expenses', { month, ...filters, page, pageSize }, { signal })),
    incomes: async (month: string, filters: IncomeFilters, page: number, signal?: AbortSignal, pageSize = PAGE_SIZE) =>
      parseIncomesPage(await client.get('/api/entries/incomes', { month, ...filters, page, pageSize }, { signal })),
    invoices: async (month: string, status?: 'PENDING' | 'PAID') => parseInvoices(await client.get('/api/invoices', { month, status })),
    invoiceEntries: async (cardId: string, referenceMonth: string) =>
      parseInvoiceEntries(await client.get(`/api/cards/${enc(cardId)}/invoices/${enc(referenceMonth)}/entries`)),
    categories: async () => parseCategories(await client.get('/api/categories')),
    cards: async () => parseCards(await client.get('/api/cards')),
    createEntry: (payload: CreateEntryPayload) => client.post<EntryDto>('/api/entries', payload),
    createInstallments: (payload: CreateInstallmentExpensesPayload) => client.post<{ items: EntryDto[] }>('/api/entries/installments', payload),
    updateExpense: (id: string, payload: UpdateExpensePayload) => client.put<EntryDto>(`/api/entries/${enc(id)}`, payload),
    deleteExpense: (id: string) => client.delete<void>(`/api/entries/${enc(id)}`),
    payEntry: (id: string) => client.post<EntryDto>(`/api/entries/${enc(id)}/pay`),
    payEntries: (ids: string[]) => client.post<PayEntriesResult>('/api/entries/pay', { ids }),
    payInvoice: (cardId: string, referenceMonth: string) => client.post<PayInvoiceResult>(`/api/cards/${enc(cardId)}/invoices/${enc(referenceMonth)}/pay`),
  };
}

export type Api = ReturnType<typeof createApi>;
