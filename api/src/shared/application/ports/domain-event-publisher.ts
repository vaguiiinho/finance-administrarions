import type { DomainEvent } from '@shared/domain/domain-event.js';

export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');
