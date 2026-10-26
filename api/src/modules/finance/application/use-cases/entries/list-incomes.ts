import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import type { EntryReadModel } from '../../ports/entry-read-model.js';
import type { EntryView, PaginationView } from '../../ports/views.js';
import { parseCategoryKey, parsePaging, parseRequiredMonth, throwIfInvalid, totalPages } from '../../queries/query-params.js';

export interface ListIncomesInput {
  month: string;
  category?: string;
  page?: string;
  pageSize?: string;
}

export interface ListIncomesResult {
  month: ReferenceMonth;
  items: EntryView[];
  pagination: PaginationView;
  subtotal: Money;
}

export class ListIncomes {
  constructor(private readonly entries: EntryReadModel) {}

  async execute(input: ListIncomesInput): Promise<ListIncomesResult> {
    const violations: FieldViolation[] = [];
    const month = parseRequiredMonth(input.month, 'month', violations);
    const categoryKey = parseCategoryKey(input.category, violations);
    const paging = parsePaging(input.page, input.pageSize, violations);
    throwIfInvalid(violations);
    if (!month) throw new InvariantViolationError('mês validado ausente.');

    const result = await this.entries.listIncomes({ month, categoryKey, paging });
    return {
      month,
      items: result.items,
      pagination: { ...paging, totalItems: result.totalItems, totalPages: totalPages(result.totalItems, paging.pageSize) },
      subtotal: result.subtotal,
    };
  }
}
