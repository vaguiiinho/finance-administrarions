import { requireOwnerId } from '../../queries/owner.js';
import type { CardReadModel, CardView } from '../../ports/card-read-model.js';

export class ListCards {
  constructor(private readonly cards: CardReadModel) {}

  async execute(input: { ownerId: string }): Promise<{ items: CardView[] }> {
    return { items: await this.cards.listAll(requireOwnerId(input.ownerId)) };
  }
}
