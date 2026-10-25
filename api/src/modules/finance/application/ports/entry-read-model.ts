import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { CardId } from '../../domain/card/value-objects/card-id.js';
import type { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import type { EntryView, Page, Paging } from './views.js';

export type ExpenseCardFilter = { kind: 'any' } | { kind: 'card'; cardId: CardId } | { kind: 'pix' };

export interface ExpenseListCriteria {
  month: ReferenceMonth;
  status?: 'PENDING' | 'PAID';
  categoryKey?: string;
  card: ExpenseCardFilter;
  paging: Paging;
}

export interface IncomeListCriteria {
  month: ReferenceMonth;
  categoryKey?: string;
  paging: Paging;
}

export interface ExpenseSubtotalRow {
  paid: Money;
  pending: Money;
}

export interface EntryReadModel {
  /** Página ordenada por date DESC, created_at DESC, id DESC + subtotal sobre TODO o conjunto filtrado. */
  listExpenses(c: ExpenseListCriteria): Promise<Page<EntryView> & { subtotal: ExpenseSubtotalRow }>;
  listIncomes(c: IncomeListCriteria): Promise<Page<EntryView> & { subtotal: Money }>;
  findById(id: EntryId): Promise<EntryView | null>;
}

export const ENTRY_READ_MODEL = Symbol('ENTRY_READ_MODEL');
