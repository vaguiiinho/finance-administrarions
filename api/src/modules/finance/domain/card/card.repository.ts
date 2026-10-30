import type { OwnerId } from '../owner/owner-id.js';
import type { Card } from './card.js';
import type { CardId } from './value-objects/card-id.js';

/** Todo método de leitura recebe o dono como primeiro parâmetro (ADR 0005 4.2); o dono de insert/update vem do aggregate. */
export interface CardRepository {
  /** Lança CardNameTakenError se o índice único (user_id, name_key) for violado (corrida). */
  insert(card: Card): Promise<void>;
  /** Idem; persiste name, closingDay, dueDay, updatedAt. WHERE id AND user_id = card.ownerId. */
  update(card: Card): Promise<void>;
  findById(ownerId: OwnerId, id: CardId): Promise<Card | null>;
  findByNameKey(ownerId: OwnerId, key: string): Promise<Card | null>;
}

export const CARD_REPOSITORY = Symbol('CARD_REPOSITORY');
