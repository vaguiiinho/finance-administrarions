import { ExpenseTotals } from '../../domain/totals/expense-totals.js';
import { FinancialTotals } from '../../domain/totals/financial-totals.js';
import type { TotalsRow } from '../ports/monthly-summary-read-model.js';

export function toFinancialTotals(row: TotalsRow): FinancialTotals {
  return FinancialTotals.of({
    income: row.income,
    expenses: ExpenseTotals.of({ paid: row.paidExpenses, pending: row.pendingExpenses }),
  });
}
