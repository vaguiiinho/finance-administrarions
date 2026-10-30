import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import type { CategoryShare, DashboardReadModel } from '../../ports/dashboard-read-model.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseRequiredMonth, throwIfInvalid } from '../../queries/query-params.js';

export class GetCategoryDistribution {
  constructor(private readonly dashboard: DashboardReadModel) {}

  async execute(input: { ownerId: string; month: string }): Promise<{ month: ReferenceMonth; total: Money; items: CategoryShare[] }> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const month = parseRequiredMonth(input.month, 'month', violations);
    throwIfInvalid(violations);
    if (!month) throw new InvariantViolationError('mês validado ausente.');

    const items = await this.dashboard.expenseDistribution(ownerId, month);
    return { month, total: Money.sum(items.map((i) => i.total)), items };
  }
}
