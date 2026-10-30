import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import type { DemoDatasetStore } from '@finance/application/demo/demo-dataset-store.js';
import type { Card } from '@finance/domain/card/card.js';
import type { Entry } from '@finance/domain/entry/entry.js';

export class FixedBusinessCalendar implements BusinessCalendar {
  constructor(private month: string) {}
  set(month: string) {
    this.month = month;
  }
  currentMonth(): YearMonth {
    const [y, m] = this.month.split('-').map(Number);
    return YearMonth.of(y, m);
  }
}

/** Registra as chamadas; `staleResult` define o que o store "decide" (idempotencia e do store, ADR 5.6). */
export class FakeDemoDatasetStore implements DemoDatasetStore {
  calls: { ownerId: string; anchor: string; version: number; build: () => { cards: Card[]; entries: Entry[] } }[] = [];
  staleResult = true;
  async replaceIfStale(
    ownerId: { value: string },
    anchor: YearMonth,
    version: number,
    build: () => { cards: Card[]; entries: Entry[] },
  ): Promise<boolean> {
    this.calls.push({ ownerId: ownerId.value, anchor: anchor.toString(), version, build });
    return this.staleResult;
  }
}
