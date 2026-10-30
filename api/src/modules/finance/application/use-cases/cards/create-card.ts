import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { Card, type CardProps } from '../../../domain/card/card.js';
import type { CardRepository } from '../../../domain/card/card.repository.js';
import { CardNameTakenError } from '../../../domain/card/errors/card-errors.js';
import { CardId } from '../../../domain/card/value-objects/card-id.js';
import { requireOwnerId } from '../../queries/owner.js';
import { toCardView } from '../../mappers/view.mapper.js';
import type { CardView } from '../../ports/card-read-model.js';

export class CreateCard {
  constructor(
    private readonly cards: CardRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: CardProps & { ownerId: string }): Promise<CardView> {
    const ownerId = requireOwnerId(input.ownerId);
    const id = CardId.create(this.ids.next());
    if (!id.ok) throw new InvariantViolationError('IdGenerator devolveu um UUID inválido.');

    const card = Card.create({ name: input.name, closingDay: input.closingDay, dueDay: input.dueDay, ownerId, id: id.value, now: this.clock.now() });
    if (await this.cards.findByNameKey(ownerId, card.name.key)) throw new CardNameTakenError();

    await this.cards.insert(card);
    await this.publisher.publish(card.pullEvents());
    return toCardView(card);
  }
}
