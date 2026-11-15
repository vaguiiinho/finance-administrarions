import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import type { OwnerDataResetOutcome, OwnerDataResetRequest } from '@finance/application/ports/owner-data-reset-store.js';

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

/** Mes corrente de negocio controlavel (substitui o FixedBusinessCalendar de demo-fakes, removido). */
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

/**
 * OwnerDataResetStore falso (ADR 0013 5.1): registra as chamadas e devolve um desfecho configuravel.
 * A decisao de pular (`condition`) e do store real; aqui o teste escolhe o desfecho.
 */
export class FakeOwnerDataResetStore {
  calls: { ownerId: string; request: OwnerDataResetRequest }[] = [];
  outcome: OwnerDataResetOutcome = { status: 'reset', deleted: { entries: 0, cards: 0 }, restored: { entries: 0, cards: 0 } };
  failWith: Error | null = null;
  async reset(ownerId: { value: string }, request: OwnerDataResetRequest): Promise<OwnerDataResetOutcome> {
    this.calls.push({ ownerId: ownerId.value, request });
    if (this.failWith) throw this.failWith;
    return this.outcome;
  }
}
