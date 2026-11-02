import type { DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';

const DAY_MS = 24 * 3_600_000;

/** Horário civil de America/Sao_Paulo via Intl (não fixa -03:00; independe do TZ do processo). */
export class SaoPauloDailyTimeCalculator implements DailyTimeCalculator {
  private readonly formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  lastOccurrence(now: Date, at: LocalTimeOfDay): Date {
    const today = this.occurrenceOnLocalDay(this.localDayStart(now), at);
    return today.getTime() <= now.getTime() ? today : this.occurrenceOnLocalDay(this.localDayStart(now) - DAY_MS, at);
  }

  nextOccurrence(now: Date, at: LocalTimeOfDay): Date {
    const today = this.occurrenceOnLocalDay(this.localDayStart(now), at);
    return today.getTime() > now.getTime() ? today : this.occurrenceOnLocalDay(this.localDayStart(now) + DAY_MS, at);
  }

  /** Meia-noite do dia civil de São Paulo, representada como se fosse UTC (só para aritmética de datas). */
  private localDayStart(instant: Date): number {
    const w = this.wallClock(instant);
    return Date.UTC(w.year, w.month - 1, w.day);
  }

  private occurrenceOnLocalDay(dayStartAsUtc: number, at: LocalTimeOfDay): Date {
    const wallAsUtc = dayStartAsUtc + (at.hour * 60 + at.minute) * 60_000;
    let instant = wallAsUtc - this.offsetAt(new Date(wallAsUtc));
    const corrected = wallAsUtc - this.offsetAt(new Date(instant));
    if (corrected !== instant) instant = corrected;
    return new Date(instant);
  }

  /** Deslocamento (ms) do relógio de São Paulo em relação a UTC no instante dado. */
  private offsetAt(instant: Date): number {
    const w = this.wallClock(instant);
    const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
  }

  private wallClock(instant: Date) {
    const get = (parts: Intl.DateTimeFormatPart[], t: string) => Number(parts.find((p) => p.type === t)?.value);
    const parts = this.formatter.formatToParts(instant);
    return {
      year: get(parts, 'year'),
      month: get(parts, 'month'),
      day: get(parts, 'day'),
      hour: get(parts, 'hour'),
      minute: get(parts, 'minute'),
      second: get(parts, 'second'),
    };
  }
}
