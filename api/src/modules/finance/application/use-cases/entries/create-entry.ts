import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { Card } from '../../../domain/card/card.js';
import type { CardRepository } from '../../../domain/card/card.repository.js';
import type { CategoryCatalog } from '../../../domain/entry/category-catalog.js';
import { Entry } from '../../../domain/entry/entry.js';
import type { EntryRepository } from '../../../domain/entry/entry.repository.js';
import { NewEntryInput, type RawEntryInput } from '../../../domain/entry/new-entry-input.js';
import { EntryId } from '../../../domain/entry/value-objects/entry-id.js';
import { CardNotFoundError } from '../../errors/application-errors.js';
import { requireOwnerId } from '../../queries/owner.js';
import { toEntryView } from '../../mappers/view.mapper.js';
import type { EntryView } from '../../ports/views.js';

export class CreateEntry {
  constructor(
    private readonly entries: EntryRepository,
    private readonly cards: CardRepository,
    private readonly catalog: CategoryCatalog,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Precedência: 400 (NewEntryInput) > 404 (cartão). */
  async execute(raw: RawEntryInput & { ownerId: string }): Promise<EntryView> {
    const { ownerId: rawOwnerId, ...fields } = raw;
    const ownerId = requireOwnerId(rawOwnerId);
    let input = NewEntryInput.parse(fields);

    let card: Card | null = null;
    if (input.paymentMethod === 'CARD' && input.cardId) {
      card = await this.cards.findById(ownerId, input.cardId);
      if (!card) throw new CardNotFoundError(input.cardId.value);
    }

    const canonical = await this.catalog.findByKey(ownerId, input.category.key);
    if (canonical) input = input.withCanonicalCategory(canonical);

    const id = EntryId.create(this.ids.next());
    if (!id.ok) throw new InvariantViolationError('IdGenerator devolveu um UUID inválido.');

    const entry = Entry.create({ id: id.value, ownerId, input, card: card?.billingInfo() ?? null, now: this.clock.now() });
    await this.entries.insert(entry);
    await this.publisher.publish(entry.pullEvents());

    return toEntryView(entry, card ? { id: card.id.value, name: card.name.value } : null);
  }
}
