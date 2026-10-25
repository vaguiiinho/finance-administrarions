import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';
import type { DomainEvent } from '@shared/domain/domain-event.js';

/** Publicação in-process sem assinantes nesta entrega (ADR 3.8): ponto de extensão futuro. */
export class InProcessEventPublisher implements DomainEventPublisher {
  async publish(_events: readonly DomainEvent[]): Promise<void> {
    // sem assinantes
  }
}
