import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';

export interface TotalsRow {
  income: Money;
  paidExpenses: Money;
  pendingExpenses: Money;
}

export interface MonthlySummaryReadModel {
  /** Mês inteiro, sem filtros. */
  summary(month: ReferenceMonth): Promise<TotalsRow>;
}

export const MONTHLY_SUMMARY_READ_MODEL = Symbol('MONTHLY_SUMMARY_READ_MODEL');
