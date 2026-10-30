import type { Clock } from '@shared/application/ports/clock.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { FieldViolation } from '@shared/domain/app-error.js';
import { parseCardProps, type CardProps } from '../../../domain/card/card.js';
import type { CardRepository } from '../../../domain/card/card.repository.js';
import { CardNameTakenError, CardValidationError } from '../../../domain/card/errors/card-errors.js';
import { CardNotFoundError, InvalidQueryError } from '../../errors/application-errors.js';
import { toCardView } from '../../mappers/view.mapper.js';
import type { CardView } from '../../ports/card-read-model.js';
import { requireOwnerId } from '../../queries/owner.js';
import { parseCardId } from '../../queries/query-params.js';

export class UpdateCard {
  constructor(
    private readonly cards: CardRepository,
    private readonly clock: Clock,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Precedência: 400 (id e props) > 404 > 409. */
  async execute(input: CardProps & { ownerId: string; id: string }): Promise<CardView> {
    const ownerId = requireOwnerId(input.ownerId);
    const violations: FieldViolation[] = [];
    const id = parseCardId(input.id, 'id', violations);
    let parsed: ReturnType<typeof parseCardProps> | null = null;
    try {
      parsed = parseCardProps(input);
    } catch (error) {
      if (!(error instanceof CardValidationError)) throw error;
      violations.push(...(error.details as { fields: FieldViolation[] }).fields);
    }
    if (violations.length > 0 || !id || !parsed) throw new InvalidQueryError(violations);

    const card = await this.cards.findById(ownerId, id);
    if (!card) throw new CardNotFoundError(id.value);

    const sameName = await this.cards.findByNameKey(ownerId, parsed.name.key);
    if (sameName && !sameName.id.equals(card.id)) throw new CardNameTakenError();

    if (card.update({ name: input.name, closingDay: input.closingDay, dueDay: input.dueDay }, this.clock.now())) {
      await this.cards.update(card);
      await this.publisher.publish(card.pullEvents());
    }
    return toCardView(card);
  }
}
