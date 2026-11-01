import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import type { Card } from '../../../domain/card/card.js';
import type { CategoryCatalog } from '../../../domain/entry/category-catalog.js';
import { EntryNotEditableError } from '../../../domain/entry/errors/entry-errors.js';
import { NewEntryInput } from '../../../domain/entry/new-entry-input.js';
import type { FinanceUnitOfWork } from '../../ports/finance-unit-of-work.js';
import type { EntryReadModel } from '../../ports/entry-read-model.js';
import type { EntryView } from '../../ports/views.js';
import { EntryNotFoundError, CardNotFoundError } from '../../errors/application-errors.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseEntryId, throwIfInvalid } from '../../queries/query-params.js';

export interface UpdateExpenseInput {
  ownerId: string;
  id: string;
  description: string;
  category: string;
  date: string;
  amount: string;
}

export class UpdateExpense {
  constructor(
    private readonly uow: FinanceUnitOfWork,
    private readonly catalog: CategoryCatalog,
    private readonly entryReadModel: EntryReadModel,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(raw: UpdateExpenseInput): Promise<EntryView> {
    const ownerId = requireOwnerId(raw.ownerId);
    const violations: FieldViolation[] = [];
    const id = parseEntryId(raw.id, 'id', violations);
    throwIfInvalid(violations);
    if (!id) throw new InvariantViolationError('id validado ausente.');

    let input = NewEntryInput.parse({
      type: 'EXPENSE',
      description: raw.description,
      category: raw.category,
      date: raw.date,
      amount: raw.amount,
      paymentMethod: 'PIX',
      cardId: null,
      paid: undefined,
    });
    const canonical = await this.catalog.findByKey(ownerId, input.category.key);
    if (canonical) input = input.withCanonicalCategory(canonical);

    const events = await this.uow.run(async ({ entries, cards }) => {
      const [entry] = await entries.findByIdsForUpdate(ownerId, [id]);
      if (!entry) throw new EntryNotFoundError(id.value);
      if (entry.isIncome()) throw new EntryNotEditableError(id.value);

      const snapshot = entry.toSnapshot();
      const dateChanged = !input.date.equals(snapshot.date);
      let card: Card | null = null;
      if (snapshot.cardId && dateChanged) {
        card = await cards.findById(ownerId, snapshot.cardId);
        if (!card) throw new CardNotFoundError(snapshot.cardId.value);
      }

      if (entry.updateExpense(input, card?.billingInfo() ?? null, this.clock.now())) {
        await entries.update(entry);
      }
      return entry.pullEvents();
    });
    if (events.length > 0) await this.publisher.publish(events);

    const view = await this.entryReadModel.findById(ownerId, id);
    if (!view) throw new EntryNotFoundError(id.value);
    return view;
  }
}
