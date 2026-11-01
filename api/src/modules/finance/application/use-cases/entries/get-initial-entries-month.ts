import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import { ReferenceMonth } from '../../../domain/billing/reference-month.js';
import { resolveInitialMonth, type MonthAdvance } from '../../../domain/initial-month/resolve-initial-month.js';
import type { PendingOverviewReadModel } from '../../ports/pending-overview-read-model.js';
import { requireOwnerId } from '../../queries/owner.js';

export interface GetInitialEntriesMonthInput {
  ownerId: string;
}
export interface GetInitialEntriesMonthOutput {
  currentMonth: ReferenceMonth;
  month: ReferenceMonth;
  advance: MonthAdvance;
}

export class GetInitialEntriesMonth {
  constructor(
    private readonly overview: PendingOverviewReadModel,
    private readonly calendar: BusinessCalendar,
  ) {}

  async execute(input: GetInitialEntriesMonthInput): Promise<GetInitialEntriesMonthOutput> {
    const ownerId = requireOwnerId(input.ownerId);
    const currentMonth = ReferenceMonth.of(this.calendar.currentMonth());
    const { firstPendingMonth, oldestPendingCardMonth, hasCard } = await this.overview.overviewFrom(ownerId, currentMonth);
    const { month, advance } = resolveInitialMonth({ currentMonth, firstPendingMonth, oldestPendingCardMonth, hasCard });
    return { currentMonth, month, advance };
  }
}
