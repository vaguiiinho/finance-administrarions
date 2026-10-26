import type { DomainEvent } from './domain-event.js';

export abstract class AggregateRoot<E extends DomainEvent = DomainEvent> {
  private events: E[] = [];

  protected record(event: E): void {
    this.events.push(event);
  }

  /** Devolve e limpa os eventos pendentes. */
  pullEvents(): E[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }
}
