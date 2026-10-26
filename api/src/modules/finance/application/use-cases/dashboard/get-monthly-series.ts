import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import type { FinancialTotals } from '../../../domain/totals/financial-totals.js';
import { toFinancialTotals } from '../../mappers/totals.mapper.js';
import type { DashboardReadModel } from '../../ports/dashboard-read-model.js';
import { parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

const MONTHS = 12;

export interface MonthlySeriesResult {
  from: ReferenceMonth;
  to: ReferenceMonth;
  points: { month: ReferenceMonth; totals: FinancialTotals }[];
}

export class GetMonthlySeries {
  constructor(private readonly dashboard: DashboardReadModel) {}

  async execute(input: { month: string }): Promise<MonthlySeriesResult> {
    const violations: FieldViolation[] = [];
    const to = parseRequiredMonth(input.month, 'month', violations);
    throwIfInvalid(violations);
    if (!to) throw new InvariantViolationError('mês validado ausente.');

    const from = to.minusMonths(MONTHS - 1);
    const rows = await this.dashboard.monthlySeries(from, to);
    if (rows.length !== MONTHS) {
      throw new InvariantViolationError(`A série deve ter ${MONTHS} pontos, recebeu ${rows.length}.`);
    }
    return { from, to, points: rows.map((row) => ({ month: row.month, totals: toFinancialTotals(row.totals) })) };
  }
}
