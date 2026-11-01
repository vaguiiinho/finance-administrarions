import type { DomainEvent } from '@shared/domain/domain-event.js';
import type { EntryStatus } from '../value-objects/entry-status.js';
import type { EntryType } from '../value-objects/entry-type.js';
import type { PaymentMethod } from '../value-objects/payment-method.js';

export class EntryCreated implements DomainEvent {
  constructor(
    readonly entryId: string,
    readonly ownerId: string,
    readonly type: EntryType,
    readonly amount: string,
    readonly date: string,
    readonly paymentMethod: PaymentMethod,
    readonly cardId: string | null,
    readonly closingDate: string | null,
    readonly dueDate: string | null,
    readonly referenceMonth: string,
    readonly status: EntryStatus,
    readonly paidAt: Date | null,
    readonly categoryKey: string,
    readonly occurredAt: Date,
  ) {}
}

export class EntryPaid implements DomainEvent {
  constructor(
    readonly entryId: string,
    readonly amount: string,
    readonly paidAt: Date,
    readonly cardId: string | null,
    readonly referenceMonth: string,
    readonly occurredAt: Date,
  ) {}
}

export interface EntryEditData {
  description: string;
  category: string;
  date: string;
  amount: string;
  referenceMonth: string;
}

export class EntryUpdated implements DomainEvent {
  constructor(
    readonly entryId: string,
    readonly ownerId: string,
    readonly before: EntryEditData,
    readonly after: EntryEditData,
    readonly occurredAt: Date,
  ) {}
}

export type EntryDomainEvent = EntryCreated | EntryPaid | EntryUpdated;
