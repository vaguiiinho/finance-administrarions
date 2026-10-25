import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { TotalsRow } from './monthly-summary-read-model.js';

export interface MonthlyRow {
  month: ReferenceMonth;
  totals: TotalsRow;
}

export interface CategoryShare {
  category: string;
  total: Money;
  /** "75.00" */
  percentage: string;
}

export interface DashboardReadModel {
  /** Um ponto por mês, com zeros. */
  monthlySeries(from: ReferenceMonth, to: ReferenceMonth): Promise<MonthlyRow[]>;
  /** Só EXPENSE, em ordem decrescente de total. */
  expenseDistribution(month: ReferenceMonth): Promise<CategoryShare[]>;
}

export const DASHBOARD_READ_MODEL = Symbol('DASHBOARD_READ_MODEL');
