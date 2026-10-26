import type { Card } from './card.js';
import type { CardId } from './value-objects/card-id.js';

export interface CardRepository {
  /** Lança CardNameTakenError se o índice único de name_key for violado (corrida). */
  insert(card: Card): Promise<void>;
  /** Idem; persiste name, closingDay, dueDay, updatedAt. */
  update(card: Card): Promise<void>;
  findById(id: CardId): Promise<Card | null>;
  findByNameKey(key: string): Promise<Card | null>;
}

export const CARD_REPOSITORY = Symbol('CARD_REPOSITORY');
