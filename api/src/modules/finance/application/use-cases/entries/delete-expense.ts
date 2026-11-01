import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import { EntryNotFoundError } from '../../errors/application-errors.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseEntryId, throwIfInvalid } from '../../queries/query-params.js';

export class DeleteExpense {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(raw: { ownerId: string; id: string }): Promise<void> {
    const ownerId = requireOwnerId(raw.ownerId);
    const violations: FieldViolation[] = [];
    const id = parseEntryId(raw.id, 'id', violations);
    throwIfInvalid(violations);
    if (!id) throw new InvariantViolationError('id validado ausente.');

    const events = await this.uow.run(async ({ entries }) => {
      const [entry] = await entries.findByIdsForUpdate(ownerId, [id]);
      if (!entry) throw new EntryNotFoundError(id.value);
      entry.deleteExpense(this.clock.now());
      await entries.delete(entry);
      return entry.pullEvents();
    });
    if (events.length > 0) await this.publisher.publish(events);
  }
}
