import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import type { Clock } from '@shared/application/ports/clock.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { requireOwnerId } from '../queries/owner.js';
import type { DemoDatasetStore } from './demo-dataset-store.js';
import { buildDemoDataset, DEMO_TEMPLATE_VERSION } from './demo-dataset.js';

export class RefreshDemoDataset {
  constructor(
    private readonly store: DemoDatasetStore,
    private readonly calendar: BusinessCalendar,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** `anchor` (AAAA-MM) opcional; padrão = mês corrente do calendário de negócio. A idempotência é do store. */
  async execute(input: { ownerId: string; anchor?: string }): Promise<{ refreshed: boolean }> {
    const ownerId = requireOwnerId(input.ownerId);
    let anchor = this.calendar.currentMonth();
    if (input.anchor !== undefined) {
      const parsed = YearMonth.parse(input.anchor);
      if (!parsed.ok) throw new InvariantViolationError('Âncora da demo inválida.');
      anchor = parsed.value;
    }
    const refreshed = await this.store.replaceIfStale(ownerId, anchor, DEMO_TEMPLATE_VERSION, () =>
      buildDemoDataset({ ownerId, anchor, ids: this.ids, now: this.clock.now() }),
    );
    return { refreshed };
  }
}
