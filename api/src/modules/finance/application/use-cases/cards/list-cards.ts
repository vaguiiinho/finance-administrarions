import type { CardReadModel, CardView } from '../../ports/card-read-model.js';

export class ListCards {
  constructor(private readonly cards: CardReadModel) {}

  async execute(_input: Record<string, never>): Promise<{ items: CardView[] }> {
    return { items: await this.cards.listAll() };
  }
}
