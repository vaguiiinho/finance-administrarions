import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';

const DAY = 24 * 3_600_000;
/** America/Sao_Paulo sem horario de verao: UTC-3 (so para os fakes; o adapter real usa Intl). */
const SP_OFFSET_MS = -3 * 3_600_000;

/** DailyTimeCalculator falso, deterministico, com UTC-3 fixo. */
export class FakeDailyTimeCalculator {
  calls: { op: 'last' | 'next'; now: Date; at: string }[] = [];
  private todayAt(now: Date, at: LocalTimeOfDay): number {
    const shifted = now.getTime() + SP_OFFSET_MS;
    const midnight = Math.floor(shifted / DAY) * DAY;
    return midnight + (at.hour * 60 + at.minute) * 60_000 - SP_OFFSET_MS;
  }
  lastOccurrence(now: Date, at: LocalTimeOfDay): Date {
    this.calls.push({ op: 'last', now, at: `${at.hour}:${at.minute}` });
    const t = this.todayAt(now, at);
    return new Date(t <= now.getTime() ? t : t - DAY);
  }
  nextOccurrence(now: Date, at: LocalTimeOfDay): Date {
    this.calls.push({ op: 'next', now, at: `${at.hour}:${at.minute}` });
    const t = this.todayAt(now, at);
    return new Date(t > now.getTime() ? t : t + DAY);
  }
}

/** ShowcaseDataPurger falso: registra chamadas e devolve contagens configuraveis. */
export class FakeShowcaseDataPurger {
  calls: { ownerId: unknown; before: Date }[] = [];
  result = { entries: 0, cards: 0 };
  failWith: Error | null = null;
  async purgeCreatedBefore(ownerId: unknown, before: Date) {
    this.calls.push({ ownerId, before });
    if (this.failWith) throw this.failWith;
    return this.result;
  }
}
