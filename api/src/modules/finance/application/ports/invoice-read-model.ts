import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import type { Money } from '@shared/domain/value-objects/money.js';
import type { InvoiceKey } from '../../domain/billing/invoice-key.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { EntryView } from './views.js';

export interface InvoiceRow {
  card: { id: string; name: string };
  referenceMonth: ReferenceMonth;
  /** MAX entre as despesas da fatura (B9). */
  closingDate: CalendarDate;
  /** MAX entre as despesas da fatura (B9). */
  dueDate: CalendarDate;
  entryCount: number;
  pendingCount: number;
  paid: Money;
  pending: Money;
}

export type InvoiceStatusFilter = 'PENDING' | 'PAID';

export interface InvoiceListCriteria {
  month: ReferenceMonth;
  /** PENDING: pendingCount > 0; PAID: pendingCount = 0. Seleciona a fatura inteira (totais não mudam). */
  status?: InvoiceStatusFilter;
}

export interface InvoiceReadModel {
  /** Uma linha por cartão com >= 1 despesa no mês; ordem dueDate asc, nome do cartão, id. */
  listByMonth(ownerId: OwnerId, criteria: InvoiceListCriteria): Promise<InvoiceRow[]>;
  /** Todas as despesas de UMA fatura, sem paginação, date DESC, created_at DESC, id DESC. */
  listEntries(ownerId: OwnerId, key: InvoiceKey): Promise<EntryView[]>;
}

export const INVOICE_READ_MODEL = Symbol('INVOICE_READ_MODEL');
