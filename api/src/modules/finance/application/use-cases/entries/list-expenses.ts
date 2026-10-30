import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import { ExpenseTotals } from '../../../domain/totals/expense-totals.js';
import type { EntryReadModel } from '../../ports/entry-read-model.js';
import type { EntryView, PaginationView } from '../../ports/views.js';
import { requireOwnerId } from '../../queries/owner.js';
import {
  parseCategoryKey,
  parseExpenseCardFilter,
  parseExpenseStatus,
  parsePaging,
  parseRequiredMonth,
  throwIfInvalid,
  totalPages,
} from '../../queries/query-params.js';

export interface ListExpensesInput {
  ownerId: string;
  month: string;
  status?: string;
  category?: string;
  cardId?: string;
  page?: string;
  pageSize?: string;
}

export interface ListExpensesResult {
  month: ReferenceMonth;
  items: EntryView[];
  pagination: PaginationView;
  subtotal: ExpenseTotals;
}

export class ListExpenses {
  constructor(private readonly entries: EntryReadModel) {}

  async execute(input: ListExpensesInput): Promise<ListExpensesResult> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const month = parseRequiredMonth(input.month, 'month', violations);
    const status = parseExpenseStatus(input.status, violations);
    const categoryKey = parseCategoryKey(input.category, violations);
    const card = parseExpenseCardFilter(input.cardId, violations);
    const paging = parsePaging(input.page, input.pageSize, violations);
    throwIfInvalid(violations);
    if (!month) throw new InvariantViolationError('mês validado ausente.');

    const result = await this.entries.listExpenses(ownerId, { month, status, categoryKey, card, paging });
    return {
      month,
      items: result.items,
      pagination: { ...paging, totalItems: result.totalItems, totalPages: totalPages(result.totalItems, paging.pageSize) },
      subtotal: ExpenseTotals.of(result.subtotal),
    };
  }
}
