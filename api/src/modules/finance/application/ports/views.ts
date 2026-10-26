import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { EntryStatus } from '../../domain/entry/value-objects/entry-status.js';
import type { EntryType } from '../../domain/entry/value-objects/entry-type.js';
import type { PaymentMethod } from '../../domain/entry/value-objects/payment-method.js';

export interface EntryView {
  id: string;
  type: EntryType;
  description: string;
  category: string;
  date: CalendarDate;
  amount: Money;
  paymentMethod: PaymentMethod;
  card: { id: string; name: string } | null;
  invoice: { closingDate: CalendarDate; dueDate: CalendarDate } | null;
  referenceMonth: ReferenceMonth;
  status: EntryStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  totalItems: number;
}

/** page >= 1; pageSize 1..100. */
export interface Paging {
  page: number;
  pageSize: number;
}

export interface PaginationView {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
