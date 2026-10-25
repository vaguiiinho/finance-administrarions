import type { FieldViolation } from '@shared/domain/app-error.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import type { FinancialTotals } from '../../../domain/totals/financial-totals.js';
import { toFinancialTotals } from '../../mappers/totals.mapper.js';
import type { MonthlySummaryReadModel } from '../../ports/monthly-summary-read-model.js';
import { parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

export class GetMonthlySummary {
  constructor(private readonly summaries: MonthlySummaryReadModel) {}

  /** Mês inteiro, sem filtros por construção (DR6). */
  async execute(input: { month: string }): Promise<{ month: ReferenceMonth; totals: FinancialTotals }> {
    const violations: FieldViolation[] = [];
    const month = parseRequiredMonth(input.month, 'month', violations);
    throwIfInvalid(violations);
    if (!month) throw new InvariantViolationError('mês validado ausente.');

    return { month, totals: toFinancialTotals(await this.summaries.summary(month)) };
  }
}
