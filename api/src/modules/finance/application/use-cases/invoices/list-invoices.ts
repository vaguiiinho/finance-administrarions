import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import { ExpenseTotals } from '../../../domain/totals/expense-totals.js';
import type { InvoiceReadModel } from '../../ports/invoice-read-model.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

export interface InvoiceItem {
  card: { id: string; name: string };
  referenceMonth: ReferenceMonth;
  closingDate: CalendarDate;
  dueDate: CalendarDate;
  entryCount: number;
  pendingCount: number;
  totals: ExpenseTotals;
}

export class ListInvoices {
  constructor(private readonly invoices: InvoiceReadModel) {}

  async execute(input: { ownerId: string; month: string }): Promise<{ month: ReferenceMonth; items: InvoiceItem[] }> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const month = parseRequiredMonth(input.month, 'month', violations);
    throwIfInvalid(violations);
    if (!month) throw new InvariantViolationError('mês validado ausente.');

    const rows = await this.invoices.listByMonth(ownerId, month);
    return {
      month,
      items: rows.map((row) => ({
        card: row.card,
        referenceMonth: row.referenceMonth,
        closingDate: row.closingDate,
        dueDate: row.dueDate,
        entryCount: row.entryCount,
        pendingCount: row.pendingCount,
        totals: ExpenseTotals.of({ paid: row.paid, pending: row.pending }),
      })),
    };
  }
}
