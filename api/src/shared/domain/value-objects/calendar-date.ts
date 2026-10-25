import { err, ok, type Result } from '../result.js';
import { InvariantViolationError } from '../app-error.js';
import { YearMonth } from './year-month.js';

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data civil (sem horário nem fuso). Nunca construída via `new Date(string)`. */
export class CalendarDate {
  private constructor(
    private readonly ym: YearMonth,
    readonly day: number,
  ) {}

  static parse(value: string): Result<CalendarDate, 'INVALID_FORMAT' | 'INVALID_DATE'> {
    const match = FORMAT.exec(value);
    if (!match) return err('INVALID_FORMAT');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return err('INVALID_DATE');
    const yearMonth = YearMonth.of(year, month);
    if (day > yearMonth.lengthInDays()) return err('INVALID_DATE');
    return ok(new CalendarDate(yearMonth, day));
  }

  /** Pré-condição: day em 1..month.lengthInDays(); violação -> InvariantViolationError. */
  static of(month: YearMonth, day: number): CalendarDate {
    if (!Number.isInteger(day) || day < 1 || day > month.lengthInDays()) {
      throw new InvariantViolationError(`Dia ${day} fora do mês ${month.toString()}`);
    }
    return new CalendarDate(month, day);
  }

  get yearMonth(): YearMonth {
    return this.ym;
  }

  compare(other: CalendarDate): -1 | 0 | 1 {
    const byMonth = this.ym.compare(other.ym);
    if (byMonth !== 0) return byMonth;
    return this.day < other.day ? -1 : this.day > other.day ? 1 : 0;
  }

  isAfter(other: CalendarDate): boolean {
    return this.compare(other) === 1;
  }

  equals(other: CalendarDate): boolean {
    return this.compare(other) === 0;
  }

  toString(): string {
    return `${this.ym.toString()}-${String(this.day).padStart(2, '0')}`;
  }
}
