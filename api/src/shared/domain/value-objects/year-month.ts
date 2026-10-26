import { err, ok, type Result } from '../result.js';
import { InvariantViolationError } from '../app-error.js';
import { CalendarDate } from './calendar-date.js';

const FORMAT = /^(\d{4})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Aritmética de mês civil, sem significado de negócio. */
export class YearMonth {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static parse(value: string): Result<YearMonth, 'INVALID_FORMAT'> {
    const match = FORMAT.exec(value);
    if (!match) return err('INVALID_FORMAT');
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 1 || month < 1 || month > 12) return err('INVALID_FORMAT');
    return ok(new YearMonth(year, month));
  }

  static of(year: number, month: number): YearMonth {
    if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new InvariantViolationError(`Mês civil inválido: ${year}-${month}`);
    }
    return new YearMonth(year, month);
  }

  lengthInDays(): 28 | 29 | 30 | 31 {
    if (this.month === 2) return isLeapYear(this.year) ? 29 : 28;
    return [4, 6, 9, 11].includes(this.month) ? 30 : 31;
  }

  next(): YearMonth {
    return this.month === 12 ? YearMonth.of(this.year + 1, 1) : YearMonth.of(this.year, this.month + 1);
  }

  minusMonths(n: number): YearMonth {
    const index = this.year * 12 + (this.month - 1) - n;
    return YearMonth.of(Math.floor(index / 12), (index % 12) + 1);
  }

  firstDay(): CalendarDate {
    return CalendarDate.of(this, 1);
  }

  compare(other: YearMonth): -1 | 0 | 1 {
    const a = this.year * 12 + this.month;
    const b = other.year * 12 + other.month;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  equals(other: YearMonth): boolean {
    return this.compare(other) === 0;
  }

  toString(): string {
    return `${String(this.year).padStart(4, '0')}-${String(this.month).padStart(2, '0')}`;
  }
}
