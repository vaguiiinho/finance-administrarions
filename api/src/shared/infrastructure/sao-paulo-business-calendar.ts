import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import type { Clock } from '@shared/application/ports/clock.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';

/** Mês corrente de negócio: o mês civil de America/Sao_Paulo no instante do Clock. */
export class SaoPauloBusinessCalendar implements BusinessCalendar {
  private readonly formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });

  constructor(private readonly clock: Clock) {}

  currentMonth(): YearMonth {
    const parts = this.formatter.formatToParts(this.clock.now());
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    return YearMonth.of(year, month);
  }
}
