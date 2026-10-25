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
  listAll(): Promise<CardView[]>;
  findById(id: CardId): Promise<CardView | null>;
}

export const CARD_READ_MODEL = Symbol('CARD_READ_MODEL');
