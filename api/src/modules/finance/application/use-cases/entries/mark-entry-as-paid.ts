import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import { EntryNotFoundError } from '../../errors/application-errors.js';
import type { EntryReadModel } from '../../ports/entry-read-model.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import type { EntryView } from '../../ports/views.js';
import { parseEntryId, throwIfInvalid } from '../../queries/query-params.js';

export class MarkEntryAsPaid {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly entryReadModel: EntryReadModel,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Precedência: 400 > 404 > 422 (receita). Idempotente para despesa já paga. */
  async execute(input: { id: string }): Promise<EntryView> {
    const violations: FieldViolation[] = [];
    const id = parseEntryId(input.id, 'id', violations);
    throwIfInvalid(violations);
    if (!id) throw new InvariantViolationError('id validado ausente.');

    const now = this.clock.now();
    const events = await this.uow.run(async ({ entries }) => {
      const [entry] = await entries.findByIdsForUpdate([id]);
      if (!entry) throw new EntryNotFoundError(id.value);
      if (entry.markAsPaid(now)) await entries.saveAll([entry]);
      return entry.pullEvents();
    });

    if (events.length > 0) await this.publisher.publish(events);

    const view = await this.entryReadModel.findById(id);
    if (!view) throw new EntryNotFoundError(id.value);
    return view;
  }
}
