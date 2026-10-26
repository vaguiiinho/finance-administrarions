import type { ExpenseTotals } from '../../../domain/totals/expense-totals.js';
import type { FinancialTotals } from '../../../domain/totals/financial-totals.js';
import type { PaginationView } from '../../../application/ports/views.js';

export function presentExpenseTotals(totals: ExpenseTotals) {
  return { total: totals.total.toString(), paid: totals.paid.toString(), pending: totals.pending.toString() };
}

export function presentTotals(totals: FinancialTotals) {
  return {
    income: totals.income.toString(),
    expenses: presentExpenseTotals(totals.expenses),
    balance: { realized: totals.realizedBalance.toString(), projected: totals.projectedBalance.toString() },
  };
}

export function presentPagination(pagination: PaginationView) {
  return { ...pagination };
}
