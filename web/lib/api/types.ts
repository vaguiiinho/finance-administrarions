/** Tipos do contrato HTTP (ADR 0001, secao 6.1). Valores monetarios sao sempre string decimal. */
export type EntryType = "EXPENSE" | "INCOME";
export type PaymentMethod = "PIX" | "CARD";
export type EntryStatus = "PENDING" | "PAID" | "RECEIVED";

export interface CardRef {
  id: string;
  name: string;
}

export interface CardDto extends CardRef {
  closingDay: number;
  dueDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDates {
  closingDate: string;
  dueDate: string;
}

export interface EntryDto {
  id: string;
  type: EntryType;
  description: string;
  category: string;
  date: string;
  amount: string;
  paymentMethod: PaymentMethod;
  card: CardRef | null;
  invoice: InvoiceDates | null;
  referenceMonth: string;
  status: EntryStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTotalsDto {
  total: string;
  paid: string;
  pending: string;
}

export interface TotalsDto {
  income: string;
  expenses: ExpenseTotalsDto;
  balance: { realized: string; projected: string };
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface InvoiceDto {
  card: CardRef;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  entryCount: number;
  pendingCount: number;
  totals: ExpenseTotalsDto;
}

export interface ExpensesPage {
  month: string;
  items: EntryDto[];
  pagination: PaginationDto;
  subtotal: ExpenseTotalsDto;
}

export interface IncomesPage {
  month: string;
  items: EntryDto[];
  pagination: PaginationDto;
  subtotal: { total: string };
}

export interface MonthlySeries {
  from: string;
  to: string;
  points: { month: string; totals: TotalsDto }[];
}

export interface CategoryDistribution {
  month: string;
  total: string;
  items: { category: string; total: string; percentage: string }[];
}

export interface PayInvoiceResult {
  cardId: string;
  referenceMonth: string;
  paidIds: string[];
  paidCount: number;
  paidAmount: string;
}

export interface PayEntriesResult {
  paidIds: string[];
  alreadyPaidIds: string[];
}

export interface CreateEntryPayload {
  type: EntryType;
  description: string;
  category: string;
  date: string;
  amount: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  paid?: boolean;
}

export interface CardPayload {
  name: string;
  closingDay: number;
  dueDay: number;
}

export interface FieldIssue {
  field: string;
  code: string;
  message: string;
}

/** Erro serializavel devolvido pelas Server Actions (ADR 9.2). */
export interface ActionError {
  status: number;
  code: string;
  message: string;
  fields?: FieldIssue[];
  missingIds?: string[];
  incomeIds?: string[];
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
