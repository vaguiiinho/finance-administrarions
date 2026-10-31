import { err, ok, type Result } from '@shared/domain/result.js';
import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';

/** Mês de competência de um lançamento. */
export class ReferenceMonth {
  private constructor(private readonly month: YearMonth) {}

  /** Faixa de negócio: anos 1900-9998 (evita estouro de aritmética de mês nas bordas do calendário). */
  static readonly MIN_YEAR = 1900;
  static readonly MAX_YEAR = 9998;

  static parse(value: string): Result<ReferenceMonth, 'INVALID_FORMAT' | 'OUT_OF_RANGE'> {
    const parsed = YearMonth.parse(value);
    if (!parsed.ok) return err('INVALID_FORMAT');
    const { year } = parsed.value;
    if (year < ReferenceMonth.MIN_YEAR || year > ReferenceMonth.MAX_YEAR) return err('OUT_OF_RANGE');
    return ok(new ReferenceMonth(parsed.value));
  }

  static of(month: YearMonth): ReferenceMonth {
    return new ReferenceMonth(month);
  }

  /** PIX (despesa ou receita): mês da data do lançamento. */
  static forPix(date: CalendarDate): ReferenceMonth {
    return new ReferenceMonth(date.yearMonth);
  }

  /** CARD: mês/ano da data de vencimento da fatura. */
  static ofDueDate(dueDate: CalendarDate): ReferenceMonth {
    return new ReferenceMonth(dueDate.yearMonth);
  }

  get yearMonth(): YearMonth {
    return this.month;
  }

  minusMonths(n: number): ReferenceMonth {
    return new ReferenceMonth(this.month.minusMonths(n));
  }

  /** Mês seguinte (ADR 0007 seção 3). */
  next(): ReferenceMonth {
    return new ReferenceMonth(this.month.next());
  }

  compare(other: ReferenceMonth): -1 | 0 | 1 {
    return this.month.compare(other.month);
  }

  equals(other: ReferenceMonth): boolean {
    return this.month.equals(other.month);
  }

  toString(): string {
    return this.month.toString();
  }
}
