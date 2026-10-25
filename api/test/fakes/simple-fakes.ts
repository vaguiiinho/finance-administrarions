import type { Clock } from '@shared/application/ports/clock.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import type { DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.js';

/** Relogio controlavel (T13: uma leitura por operacao). */
export class FixedClock implements Clock {
  reads = 0;
  constructor(private current: Date) {}
  now(): Date {
    this.reads++;
    return new Date(this.current.getTime());
  }
  set(next: Date): void {
    this.current = next;
  }
}

/** Gera UUIDs v7 deterministicos (versao 7, variante 8). */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  next(): string {
    this.counter++;
    return `0192f1e2-0000-7000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

export class SpyEventPublisher implements DomainEventPublisher {
  readonly published: object[] = [];
  batches = 0;
  async publish(events: readonly object[]): Promise<void> {
    this.batches++;
    this.published.push(...events);
  }
  names(): string[] {
    return this.published.map((e) => e.constructor.name);
  }
}
