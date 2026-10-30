import type { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../domain/billing/reference-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
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
  monthlySeries(ownerId: OwnerId, from: ReferenceMonth, to: ReferenceMonth): Promise<MonthlyRow[]>;
  /** Só EXPENSE, em ordem decrescente de total. */
  expenseDistribution(ownerId: OwnerId, month: ReferenceMonth): Promise<CategoryShare[]>;
}

export const DASHBOARD_READ_MODEL = Symbol('DASHBOARD_READ_MODEL');
