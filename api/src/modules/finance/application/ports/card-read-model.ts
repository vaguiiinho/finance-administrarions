import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { CardId } from '../../domain/card/value-objects/card-id.js';

export interface CardView {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardReadModel {
  /** Ordenado por nome. */
  listAll(ownerId: OwnerId): Promise<CardView[]>;
  findById(ownerId: OwnerId, id: CardId): Promise<CardView | null>;
}

export const CARD_READ_MODEL = Symbol('CARD_READ_MODEL');
