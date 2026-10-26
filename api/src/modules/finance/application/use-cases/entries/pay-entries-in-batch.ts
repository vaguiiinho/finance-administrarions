import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { FieldViolation } from '@shared/domain/app-error.js';
import type { EntryPaymentService } from '../../../domain/payment/entry-payment.service.js';
import type { EntryId } from '../../../domain/entry/value-objects/entry-id.js';
import { EntriesNotFoundError } from '../../errors/application-errors.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import { parseEntryId, throwIfInvalid, violation } from '../../queries/query-params.js';

const MAX_IDS = 100;

export class PayEntriesInBatch {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly paymentService: EntryPaymentService,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Precedência: 400 > 404 (todos os ausentes) > 422 (todas as receitas). Tudo ou nada. */
  async execute(input: { ids: string[] }): Promise<{ paidIds: string[]; alreadyPaidIds: string[] }> {
    const ids = this.parse(input.ids);
    const now = this.clock.now();

    const { outcome, events } = await this.uow.run(async ({ entries }) => {
      const found = await entries.findByIdsForUpdate(ids);
      const foundIds = new Set(found.map((e) => e.id.value));
      const missing = ids.filter((id) => !foundIds.has(id.value)).map((id) => id.value);
      if (missing.length > 0) throw new EntriesNotFoundError(missing);

      const result = this.paymentService.payAll(found, now);
      if (result.paid.length > 0) await entries.saveAll(result.paid);
      return { outcome: result, events: result.paid.flatMap((e) => e.pullEvents()) };
    });

    await this.publishIfAny(events);

    const paid = new Set(outcome.paid.map((e) => e.id.value));
    return {
      paidIds: ids.filter((id) => paid.has(id.value)).map((id) => id.value),
      alreadyPaidIds: ids.filter((id) => !paid.has(id.value)).map((id) => id.value),
    };
  }

  private parse(raw: readonly string[]): EntryId[] {
    const violations: FieldViolation[] = [];
    if (raw.length === 0) violations.push(violation('ids', 'EMPTY'));
    if (raw.length > MAX_IDS) violations.push(violation('ids', 'TOO_MANY_ITEMS'));

    const parsed: EntryId[] = [];
    const seen = new Set<string>();
    raw.forEach((value, index) => {
      const id = parseEntryId(value, `ids[${index}]`, violations);
      if (id && !seen.has(id.value)) {
        seen.add(id.value);
        parsed.push(id);
      }
    });
    throwIfInvalid(violations);
    return parsed;
  }

  private async publishIfAny(events: Parameters<DomainEventPublisher['publish']>[0]): Promise<void> {
    if (events.length > 0) await this.publisher.publish(events);
  }
}
