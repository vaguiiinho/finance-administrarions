import type { DomainEvent } from '@shared/domain/domain-event.js';

export interface CardData {
  name: string;
  closingDay: number;
  dueDay: number;
}

export class CardCreated implements DomainEvent {
  constructor(
    readonly cardId: string,
    readonly ownerId: string,
    readonly name: string,
    readonly closingDay: number,
    readonly dueDay: number,
    readonly occurredAt: Date,
  ) {}
}

export class CardUpdated implements DomainEvent {
  constructor(
    readonly cardId: string,
    readonly before: CardData,
    readonly after: CardData,
    readonly occurredAt: Date,
  ) {}
}

export type CardDomainEvent = CardCreated | CardUpdated;
